/**
 * Solves a Multidimensional Scaling problem with gradient descent.
 *
 * If momentum is != 0, the update is:
 *
 * accumulation = momentum * accumulation + gradient
 * parameters -= learning_rate * accumulation
 *
 * like in TensorFlow and PyTorch.
 *
 * In the returned object, coordinates is a matrix of shape (n, 2) containing
 * the solution.
 *
 * @param {!mlMatrix.Matrix} distances - matrix of shape (n, n) containing the
 *   distances between n points.
 * @param {!number} lr - learning rate to use.
 * @param {!number} maxSteps - maximum number of update steps.
 * @param {!number} minLossDifference - if the absolute difference between the
 *   losses of the current and the previous optimization step is smaller than
 *   this value, the function will return early.
 * @param {!number} momentum - momentum of the gradient descent. Set this value
 *   to zero to disable momentum.
 * @param {!number} logEvery - if larger than zero, this value determines the
 *   steps between logs to the console.
 * @returns {{coordinates: mlMatrix.Matrix, lossPerStep: number[]}}
 */
function getMdsCoordinatesWithGradientDescent(distances,
                                              {
                                                  lr = 1,
                                                  maxSteps = 200,
                                                  minLossDifference = 1e-7,
                                                  momentum = 0,
                                                  logEvery = 0
                                              } = {}) {
    const numCoordinates = distances.rows;
    let coordinates = getInitialMdsCoordinates(numCoordinates);

    const lossPerStep = [];
    let accumulation = null;

    for (let step = 0; step &lt; maxSteps; step++) {
        const loss = getMdsLoss(distances, coordinates);
        lossPerStep.push(loss);

        // Check if we should early stop.
        if (lossPerStep.length &gt; 1) {
            const lossPrev = lossPerStep[lossPerStep.length - 2];
            if (Math.abs(lossPrev - loss) &lt; minLossDifference) {
                return {coordinates: coordinates, lossPerStep: lossPerStep};
            }
        }

        if (logEvery &gt; 0 && step % logEvery === 0) {
            console.log(`Step: ${step}, loss: ${loss}`);
        }

        // Apply the gradient for each coordinate.
        for (let coordIndex = 0; coordIndex &lt; numCoordinates; coordIndex++) {
            const gradient = getGradientForCoordinate(
                distances, coordinates, coordIndex);

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

/**
 * Returns the gradient of the loss w.r.t. to a specific point in the
 * given solution.
 *
 * The returned matrix has the shape (1, d), where d is the number of
 * dimensions.
 *
 * @param {!mlMatrix.Matrix} distances - matrix of shape (n, n) containing the
 *   distances between n points, defining the MDS problem.
 * @param {!mlMatrix.Matrix} coordinates - a matrix of shape (n, d) containing
 *   the current solution, where d is the number of dimensions.
 * @param {!number} coordIndex - index of the point for which the gradient
 *   shall be computed.
 * @returns {mlMatrix.Matrix}
 */
function getGradientForCoordinate(distances, coordinates, coordIndex) {
    const coord = coordinates.getRowVector(coordIndex);
    const normalizer = Math.pow(coordinates.rows, 2);
    let gradient = mlMatrix.Matrix.zeros(1, coord.columns);

    for (let otherCoordIndex = 0;
         otherCoordIndex &lt; coordinates.rows;
         otherCoordIndex++) {

        if (coordIndex === otherCoordIndex) continue;

        const otherCoord = coordinates.getRowVector(otherCoordIndex);
        const squaredDifferenceSum = mlMatrix.Matrix.sub(
            coord, otherCoord).pow(2).sum();
        const predicted = Math.sqrt(squaredDifferenceSum);
        const targets = [
            distances.get(coordIndex, otherCoordIndex),
            distances.get(otherCoordIndex, coordIndex)
        ];

        for (const target of targets) {
            const lossWrtPredicted = -2 * (target - predicted) / normalizer;
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

/**
 * Initializes the solution by sampling from a uniform distribution, which
 * only allows distances in [0, 1].
 *
 * @param {!number} numCoordinates - the number of points in the solution.
 * @param {!number} dimensions - the number of dimensions of each point.
 * @param {!number} seed - seed for the random number generator.
 * @returns {mlMatrix.Matrix}
 */
function getInitialMdsCoordinates(numCoordinates, dimensions = 2, seed = 0) {
    const randomUniform = mlMatrix.Matrix.rand(
        numCoordinates, dimensions, {random: new Math.seedrandom(seed)});
    return mlMatrix.Matrix.div(randomUniform, Math.sqrt(dimensions));
}

/**
 * Returns the loss of a given solution to the Multidimensional Scaling
 * problem by computing the mean squared difference between target distances
 * and distances between points in the solution.
 *
 * @param {!mlMatrix.Matrix} distances - matrix of shape (n, n) containing the
 *   distances between n points, defining the MDS problem.
 * @param {!mlMatrix.Matrix} coordinates - a matrix of shape (n, d) containing
 *   the solution, for example given by getMdsCoordinatesWithGaussNewton(...).
 *   d is the number of dimensions.
 * @returns {number}
 */
function getMdsLoss(distances, coordinates) {
    // Average the squared differences of target distances and predicted
    // distances.
    let loss = 0;
    const normalizer = Math.pow(coordinates.rows, 2);
    for (let coordIndex1 = 0;
         coordIndex1 &lt; coordinates.rows;
         coordIndex1++) {

        for (let coordIndex2 = 0;
             coordIndex2 &lt; coordinates.rows;
             coordIndex2++) {

            if (coordIndex1 === coordIndex2) continue;

            const coord1 = coordinates.getRowVector(coordIndex1);
            const coord2 = coordinates.getRowVector(coordIndex2);
            const target = distances.get(coordIndex1, coordIndex2);
            const predicted = mlMatrix.Matrix.sub(coord1, coord2).norm();
            loss += Math.pow(target - predicted, 2) / normalizer;
        }
    }
    return loss;
}