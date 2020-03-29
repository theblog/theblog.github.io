function getMdsCoordinatesWithGaussNewton(distances,
                                          {
                                              lr = 0.1,
                                              maxSteps = 200,
                                              minLossDifference = 1e-7,
                                              logEvery = 0
                                          } = {}) {
    const numCoordinates = distances.rows;
    let coordinates = getInitialMdsCoordinates(numCoordinates);
    const dimensions = coordinates.columns;

    const lossPerStep = [];

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

        // Apply the update
        const {residuals, jacobian} = getResidualsWithJacobian(distances, coordinates);
        const update = mlMatrix.pseudoInverse(jacobian).mmul(residuals);
        for (let coordIndex = 0; coordIndex < numCoordinates; coordIndex++) {
            for (let dimension = 0; dimension < dimensions; dimension++) {
                const updateIndex = coordIndex * dimensions + dimension;
                const paramValue = coordinates.get(coordIndex, dimension);
                const updatedValue = paramValue - lr * update.get(updateIndex, 0);
                coordinates.set(coordIndex, dimension, updatedValue);
            }
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

function getResidualsWithJacobian(distances, coordinates) {
    // The residuals are returned in a flattened vector as (target - predicted) / numCoordinates.
    // The flattened vector is ordered based on iterating the matrix given by distances
    // in row-major order.
    // We divide by coordinates.rows, so that the sum of squared residuals equals the MDS loss,
    // which involves a division by coordinates.rows ** 2.
    const residuals = [];

    // The element of the Jacobian at row i and column j should contain the partial derivative
    // of the i-th residual w.r.t. the j-th coordinate. The coordinates are indexed in
    // row-major order, such that in two dimensions, the 5th zero-based index corresponds to the
    // second coordinate of the third point.
    const numCoordinates = coordinates.rows;
    const dimensions = coordinates.columns;
    const jacobian = mlMatrix.Matrix.zeros(
        numCoordinates * numCoordinates,
        numCoordinates * dimensions);

    for (let coordIndex1 = 0; coordIndex1 < numCoordinates; coordIndex1++) {
        for (let coordIndex2 = 0; coordIndex2 < numCoordinates; coordIndex2++) {
            if (coordIndex1 === coordIndex2) {
                residuals.push(0);
                // The gradient for all coordinates is zero, so we can skip this row of the
                // jacobian.
                continue;
            }

            const coord1 = coordinates.getRowVector(coordIndex1);
            const coord2 = coordinates.getRowVector(coordIndex2);
            const squaredDifferenceSum = mlMatrix.Matrix.sub(coord1, coord2).pow(2).sum();
            const predicted = Math.sqrt(squaredDifferenceSum);
            const target = distances.get(coordIndex1, coordIndex2);
            const residual = (target - predicted) / numCoordinates;
            residuals.push(residual);

            // Compute the gradient w.r.t. the first coordinate only. The second coordinate is
            // seen as a constant.
            const residualWrtPredicted = -1 / numCoordinates;
            const predictedWrtSquaredDifferenceSum = 0.5 / Math.sqrt(squaredDifferenceSum);
            const squaredDifferenceSumWrtCoord1 = mlMatrix.Matrix.mul(
                mlMatrix.Matrix.sub(coord1, coord2), 2);
            const residualWrtCoord1 = mlMatrix.Matrix.mul(
                squaredDifferenceSumWrtCoord1,
                residualWrtPredicted * predictedWrtSquaredDifferenceSum
            );

            // Set the corresponding indices in the jacobian
            const rowIndex = numCoordinates * coordIndex1 + coordIndex2;
            for (let dimension = 0; dimension < dimensions; dimension++) {
                const columIndex = dimensions * coordIndex1 + dimension;
                const jacobianEntry = jacobian.get(rowIndex, columIndex);
                const entryUpdated = jacobianEntry + residualWrtCoord1.get(0, dimension);
                jacobian.set(rowIndex, columIndex, entryUpdated);
            }
        }
    }
    return {residuals: mlMatrix.Matrix.columnVector(residuals), jacobian: jacobian};
}

