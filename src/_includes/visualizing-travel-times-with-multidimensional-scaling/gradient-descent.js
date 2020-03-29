function getMdsCoordinatesWithGradientDescent(distances,
                                              {
                                                  lr = 1,
                                                  maxSteps = 200,
                                                  minLossDifference = 1e-7,
                                                  momentum = 0,
                                                  logEvery = 0
                                              } = {}) {
    /*
    * If momentum is != 0, the update is:
    *
    * accumulation = momentum * accumulation + gradient
    * parameters -= learning_rate * accumulation
    *
    * like in TensorFlow and PyTorch
    *
    */

    const numCoordinates = distances.rows;
    let coordinates = getInitialMdsCoordinates(numCoordinates);

    const lossPerStep = [];
    let accumulation = null;

    for (let step = 0; step < maxSteps; step++) {
        const loss = getMdsLoss(distances, coordinates);
        lossPerStep.push(loss);

        // Check if we should early stop.
        const lossPrev = lossPerStep.length > 1 ? lossPerStep[lossPerStep.length - 2] : null;
        if (lossPrev != null && Math.abs(lossPrev - loss) < minLossDifference) {
            return {coordinates: coordinates, lossPerStep: lossPerStep};
        }

        if (logEvery > 0 && step % logEvery === 0) {
            console.log(`Step: ${step}, loss: ${loss}`);
        }

        // Apply the gradient for each coordinate.
        for (let coordIndex = 0; coordIndex < numCoordinates; coordIndex++) {
            const gradient = getGradientForCoordinate(distances, coordinates, coordIndex);
            if (momentum === 0 || accumulation == null) {
                accumulation = gradient;
            } else {
                accumulation = mlMatrix.Matrix.add(
                    mlMatrix.Matrix.mul(accumulation, momentum),
                    gradient
                );
            }
            const update = mlMatrix.Matrix.mul(accumulation, lr);
            const updatedCoordinates = mlMatrix.Matrix.sub(
                coordinates.getRowVector(coordIndex),
                update);
            coordinates.setRow(coordIndex, updatedCoordinates);
        }
    }

    return {coordinates: coordinates, lossPerStep: lossPerStep};
}

function getInitialMdsCoordinates(numCoordinates, dimensions = 2, seed = 0) {
    // Initialize the solution by sampling from a uniform distribution, which only allows distances
    // in [0, 1].
    return mlMatrix.Matrix.div(
        mlMatrix.Matrix.rand(numCoordinates, dimensions, {random: new Math.seedrandom(seed)}),
        Math.sqrt(dimensions));
}

function getMdsLoss(distances, coordinates) {
    // Average the squared differences of target distances and predicted distances
    let loss = 0;
    for (let coordIndex1 = 0; coordIndex1 < coordinates.rows; coordIndex1++) {
        for (let coordIndex2 = 0; coordIndex2 < coordinates.rows; coordIndex2++) {
            if (coordIndex1 === coordIndex2) continue;

            const coord1 = coordinates.getRowVector(coordIndex1);
            const coord2 = coordinates.getRowVector(coordIndex2);
            const target = distances.get(coordIndex1, coordIndex2);
            const predicted = mlMatrix.Matrix.sub(coord1, coord2).norm();
            loss += Math.pow(target - predicted, 2) / Math.pow(coordinates.rows, 2);
        }
    }
    return loss;
}


function getGradientForCoordinate(distances, coordinates, coordIndex) {
    const coord = coordinates.getRowVector(coordIndex);
    let gradient = mlMatrix.Matrix.zeros(1, coord.columns);

    for (let otherCoordIndex = 0; otherCoordIndex < coordinates.rows; otherCoordIndex++) {
        if (coordIndex === otherCoordIndex) continue;

        const otherCoord = coordinates.getRowVector(otherCoordIndex);
        const squaredDifferenceSum = mlMatrix.Matrix.sub(coord, otherCoord).pow(2).sum();
        const predicted = Math.sqrt(squaredDifferenceSum);
        const targets = [
            distances.get(coordIndex, otherCoordIndex),
            distances.get(otherCoordIndex, coordIndex)
        ];

        for (const target of targets) {
            const lossWrtPredicted = -2 * (target - predicted) / Math.pow(coordinates.rows, 2);
            const predictedWrtSquaredDifferenceSum = 0.5 / Math.sqrt(squaredDifferenceSum);
            const squaredDifferenceSumWrtCoord = mlMatrix.Matrix.mul(
                mlMatrix.Matrix.sub(coord, otherCoord), 2);
            const lossWrtCoord = mlMatrix.Matrix.mul(
                squaredDifferenceSumWrtCoord,
                lossWrtPredicted * predictedWrtSquaredDifferenceSum
            );
            gradient = mlMatrix.Matrix.add(gradient, lossWrtCoord);
        }
    }

    return gradient;
}