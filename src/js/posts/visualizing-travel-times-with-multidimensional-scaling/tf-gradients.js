function getMdsLossTf(distances, coordinates) {
    const coordinatesTensor = tf.tensor2d(coordinates.to2DArray(),
        [coordinates.rows, coordinates.columns]);
    return getMdsLossTfFunction(distances, coordinatesTensor);
}

function getMdsLossTfFunction(distances, coordinatesTensor) {
    const numCoordinates = coordinatesTensor.shape[0];
    let loss = tf.scalar(0);
    for (let coordIndex1 = 0; coordIndex1 < numCoordinates; coordIndex1++) {
        for (let coordIndex2 = 0; coordIndex2 < numCoordinates; coordIndex2++) {
            if (coordIndex1 === coordIndex2) continue;

            const coord1 = tf.gather(coordinatesTensor, [coordIndex1]);
            const coord2 = tf.gather(coordinatesTensor, [coordIndex2]);
            const target = distances.get(coordIndex1, coordIndex2);
            const actual = tf.sqrt(tf.sum(tf.squaredDifference(coord1, coord2)));
            const lossPart = tf.div(
                tf.squaredDifference(target, actual),
                Math.pow(numCoordinates, 2));
            loss = tf.add(loss, lossPart);
        }
    }
    return loss;
}

function getGradientForCoordinateTf(distances, coordinates, coordIndex) {
    const coordinatesTensor = tf.tensor2d(coordinates.to2DArray(),
        [coordinates.rows, coordinates.columns]);
    const f = x => getMdsLossTfFunction(distances, x);
    const gradientFun = tf.grad(f);
    const gradient = gradientFun(coordinatesTensor);
    return tf.gather(gradient, [coordIndex]).dataSync();
}