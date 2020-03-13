/* From https://stackoverflow.com/a/27943/2628369 */

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

/* From https://stackoverflow.com/a/39343864/2628369 */

function getMaxOfArray(a) {
    // Return the maximum of a multi-dimensional array
    return Math.max(...a.map(e => Array.isArray(e) ? getMaxOfArray(e) : e));
}

function getMinOfArray(a) {
    // Return the minimum of a multi-dimensional array
    return Math.min(...a.map(e => Array.isArray(e) ? getMinOfArray(e) : e));
}

/* From http://www.benfrederickson.com/multidimensional-scaling/ */

function getMdsCoordinatesClassic(distances, dimensions) {
    return new mlMatrix.Matrix(getMdsCoordinatesClassicRaw(distances.to2DArray(), dimensions));
}

function getMdsCoordinatesClassicRaw(distances, dimensions) {
    dimensions = dimensions || 2;

    // square distances
    var M = numeric.mul(-.5, numeric.pow(distances, 2));

    // double centre the rows/columns
    function mean(A) { return numeric.div(numeric.add.apply(null, A), A.length); }
    var rowMeans = mean(M),
        colMeans = mean(numeric.transpose(M)),
        totalMean = mean(rowMeans);

    for (var i = 0; i < M.length; ++i) {
        for (var j =0; j < M[0].length; ++j) {
            M[i][j] += totalMean - rowMeans[i] - colMeans[j];
        }
    }

    // take the SVD of the double centred matrix, and return the
    // points from it
    var ret = numeric.svd(M),
        eigenValues = numeric.sqrt(ret.S);
    return ret.U.map(function(row) {
        return numeric.mul(row, eigenValues).splice(0, dimensions);
    });
}