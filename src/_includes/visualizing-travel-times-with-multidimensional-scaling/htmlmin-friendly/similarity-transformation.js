{% raw %}/**
 * Transform a tuple of source points to match a tuple of target points
 * following equation 40, 41 and 42 of umeyama_1991.
 *
 * This function expects two mlMatrix.Matrix instances of the same shape
 * (m, n), where n is the number of points and m is the number of dimensions.
 * This is the shape used by umeyama_1991. m and n can take any positive value.
 *
 * The returned matrix contains the transformed points.
 *
 * @param {!mlMatrix.Matrix} fromPoints - the source points {x_1, ..., x_n}.
 * @param {!mlMatrix.Matrix} toPoints - the target points {y_1, ..., y_n}.
 * @param {boolean} allowReflection - If true, the source points may be
 *   reflected to achieve a better mean squared error.
 * @returns {mlMatrix.Matrix}
 */
function getSimilarityTransformation(fromPoints,
                                     toPoints,
                                     allowReflection = false) {
    const dimensions = fromPoints.rows;
    const numPoints = fromPoints.columns;

    // 1. Compute the rotation.
    const covarianceMatrix = getSimilarityTransformationCovariance(
        fromPoints,
        toPoints);

    const {
        svd,
        mirrorIdentityForSolution
    } = getSimilarityTransformationSvdWithMirrorIdentities(
        covarianceMatrix,
        allowReflection);

    const rotation = svd.U
        .mmul(mlMatrix.Matrix.diag(mirrorIdentityForSolution))
        .mmul(svd.V.transpose());

    // 2. Compute the scale.
    // The variance will first be a 1-D array and then reduced to a scalar.
    const summator = (sum, elem) =&gt; {
        return sum + elem;
    };
    const fromVariance = fromPoints
        .variance('row', {unbiased: false})
        .reduce(summator);

    let trace = 0;
    for (let dimension = 0; dimension &lt; dimensions; dimension++) {
        const mirrorEntry = mirrorIdentityForSolution[dimension];
        trace += svd.diagonal[dimension] * mirrorEntry;
    }
    const scale = trace / fromVariance;

    // 3. Compute the translation.
    const fromMean = mlMatrix.Matrix.columnVector(fromPoints.mean('row'));
    const toMean = mlMatrix.Matrix.columnVector(toPoints.mean('row'));
    const translation = mlMatrix.Matrix.sub(
        toMean,
        mlMatrix.Matrix.mul(rotation.mmul(fromMean), scale));

    // 4. Transform the points.
    const transformedPoints = mlMatrix.Matrix.add(
        mlMatrix.Matrix.mul(rotation.mmul(fromPoints), scale),
        translation.repeat({columns: numPoints}));

    return transformedPoints;
}

/**
 * Compute the mean squared error of a given solution, following equation 1
 * in umeyama_1991.
 *
 * This function expects two mlMatrix.Matrix instances of the same shape
 * (m, n), where n is the number of points and m is the number of dimensions.
 * This is the shape used by umeyama_1991.
 *
 * @param {!mlMatrix.Matrix} transformedPoints - the solution, for example
 *   returned by getSimilarityTransformation(...).
 * @param {!mlMatrix.Matrix} toPoints - the target points {y_1, ..., y_n}.
 * @returns {number}
 */
function getSimilarityTransformationError(transformedPoints, toPoints) {
    const numPoints = transformedPoints.columns;
    const difference = mlMatrix.Matrix.sub(toPoints, transformedPoints);
    return Math.pow(difference.norm('frobenius'), 2) / numPoints;
}

/**
 * Compute the minimum possible mean squared error for a given problem,
 * following equation 33 in umeyama_1991.
 *
 * This function expects two mlMatrix.Matrix instances of the same shape
 * (m, n), where n is the number of points and m is the number of dimensions.
 * This is the shape used by umeyama_1991. m and n can take any positive value.
 *
 * @param {!mlMatrix.Matrix} fromPoints - the source points {x_1, ..., x_n}.
 * @param {!mlMatrix.Matrix} toPoints - the target points {y_1, ..., y_n}.
 * @param {boolean} allowReflection - If true, the source points may be
 *   reflected to achieve a better mean squared error.
 * @returns {number}
 */
function getSimilarityTransformationErrorBound(fromPoints,
                                               toPoints,
                                               allowReflection = false) {
    const dimensions = fromPoints.rows;

    // The variances will first be 1-D arrays and then reduced to a scalar.
    const summator = (sum, elem) =&gt; {
        return sum + elem;
    };
    const fromVariance = fromPoints
        .variance('row', {unbiased: false})
        .reduce(summator);
    const toVariance = toPoints
        .variance('row', {unbiased: false})
        .reduce(summator);
    const covarianceMatrix = getSimilarityTransformationCovariance(
        fromPoints,
        toPoints);

    const {
        svd,
        mirrorIdentityForErrorBound
    } = getSimilarityTransformationSvdWithMirrorIdentities(
        covarianceMatrix,
        allowReflection);

    let trace = 0;
    for (let dimension = 0; dimension &lt; dimensions; dimension++) {
        const mirrorEntry = mirrorIdentityForErrorBound[dimension];
        trace += svd.diagonal[dimension] * mirrorEntry;
    }
    return toVariance - Math.pow(trace, 2) / fromVariance;
}

/**
 * Computes the covariance matrix of the source points and the target points
 * following equation 38 in umeyama_1991.
 *
 * This function expects two mlMatrix.Matrix instances of the same shape
 * (m, n), where n is the number of points and m is the number of dimensions.
 * This is the shape used by umeyama_1991. m and n can take any positive value.
 *
 * @param {!mlMatrix.Matrix} fromPoints - the source points {x_1, ..., x_n}.
 * @param {!mlMatrix.Matrix} toPoints - the target points {y_1, ..., y_n}.
 * @returns {mlMatrix.Matrix}
 */
function getSimilarityTransformationCovariance(fromPoints, toPoints) {
    const dimensions = fromPoints.rows;
    const numPoints = fromPoints.columns;
    const fromMean = mlMatrix.Matrix.columnVector(fromPoints.mean('row'));
    const toMean = mlMatrix.Matrix.columnVector(toPoints.mean('row'));

    const covariance = mlMatrix.Matrix.zeros(dimensions, dimensions);

    for (let pointIndex = 0; pointIndex &lt; numPoints; pointIndex++) {
        const fromPoint = fromPoints.getColumnVector(pointIndex);
        const toPoint = toPoints.getColumnVector(pointIndex);
        const outer = mlMatrix.Matrix.sub(toPoint, toMean)
            .mmul(mlMatrix.Matrix.sub(fromPoint, fromMean).transpose());

        covariance.addM(mlMatrix.Matrix.div(outer, numPoints));
    }

    return covariance;
}

/**
 * Computes the SVD of the covariance matrix and returns the mirror identities
 * (called S in umeyama_1991), following equation 39 and 43 in umeyama_1991.
 *
 * See getSimilarityTransformationCovariance(...) for more details on how to
 * compute the covariance matrix.
 *
 * @param {!mlMatrix.Matrix} covarianceMatrix - the matrix returned by
 *   getSimilarityTransformationCovariance(...)
 * @param {boolean} allowReflection - If true, the source points may be
 *   reflected to achieve a better mean squared error.
 * @returns {{
 *   svd: mlMatrix.SVD,
 *   mirrorIdentityForErrorBound: number[],
 *   mirrorIdentityForSolution: number[]
 * }}
 */
function getSimilarityTransformationSvdWithMirrorIdentities(covarianceMatrix,
                                                            allowReflection) {
    // Compute the SVD.
    const dimensions = covarianceMatrix.rows;
    const svd = new mlMatrix.SVD(covarianceMatrix);

    // Compute the mirror identities based on the equations in umeyama_1991.
    let mirrorIdentityForErrorBound = Array(svd.diagonal.length).fill(1);
    let mirrorIdentityForSolution = Array(svd.diagonal.length).fill(1);
    if (!allowReflection) {
        // Compute equation 39 in umeyama_1991.
        if (mlMatrix.determinant(covarianceMatrix) &lt; 0) {
            const lastIndex = mirrorIdentityForErrorBound.length - 1;
            mirrorIdentityForErrorBound[lastIndex] = -1;
        }

        // Check the rank condition mentioned directly after equation 43.
        mirrorIdentityForSolution = mirrorIdentityForErrorBound;
        if (svd.rank === dimensions - 1) {
            // Compute equation 43 in umeyama_1991.
            mirrorIdentityForSolution = Array(svd.diagonal.length).fill(1);
            if (mlMatrix.determinant(svd.U) * mlMatrix.determinant(svd.V) &lt; 0) {
                const lastIndex = mirrorIdentityForSolution.length - 1;
                mirrorIdentityForSolution[lastIndex] = -1;
            }
        }
    }

    return {
        svd: svd,
        mirrorIdentityForErrorBound: mirrorIdentityForErrorBound,
        mirrorIdentityForSolution: mirrorIdentityForSolution
    }
}{% endraw %}
