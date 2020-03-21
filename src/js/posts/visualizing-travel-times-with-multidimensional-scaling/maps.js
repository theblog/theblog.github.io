const INITIAL_CITY_NAMES = ['San Francisco', 'Sacramento', 'Los Angeles', 'Las Vegas'];
// const INITIAL_CITY_NAMES = ['Berlin', 'Munich', 'Stuttgart', 'Illertissen'];

const CITY_MAP_ID = 'city-map';
const COORDINATE_MAP_ID = 'coordinate-map';
const DISTANCE_TABLE_ID = 'distance-table';
const DURATION_TABLE_ID = 'duration-table';

const CUSTOM_MAP_TYPE_ID = 'customStyle';
const CUSTOM_MAP_TYPE = new google.maps.StyledMapType([{
    stylers: [{
        visibility: 'simplified'
    }]
}, {
    featureType: 'road',
    stylers: [{
        visibility: 'off'
    }]
}, {
    featureType: 'administrative',
    stylers: [{
        visibility: 'off'
    }]
}, {
    featureType: 'poi',
    stylers: [{
        visibility: 'off'
    }]
}, {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{
        visibility: 'on'
    }]
}], {
    name: 'Custom Style'
});

const MAP_OPTIONS = {
    center: {
        lat: 36.1141105,
        lng: -116.4614945
    },
    zoom: 3,
    navigationControl: false,
    mapTypeControl: false,
    scrollwheel: false,
    streetViewControl: false,
    disableDefaultUI: true
};

const UNIT_SECONDS = 'seconds';
const UNIT_KILOMETERS = 'km';

// Pseudo-constant variables that are initialized only once
let CITY_MAP;
let COORDINATE_MAP;
let GEOCODER;
let DISTANCE_MATRIX_SERVICE;

// MAIN Function
$(function () {
    Chart.defaults.global.maintainAspectRatio = false;
    Chart.defaults.global.elements.line.fill = false;
    Chart.defaults.global.elements.line.tension = 0;
    Chart.defaults.global.elements.point.radius = 0;

    const state = {
        cities: [],
        cityMarkers: [],
        mdsMarkers: [],
    };

    GEOCODER = new google.maps.Geocoder();
    DISTANCE_MATRIX_SERVICE = new google.maps.DistanceMatrixService();

    initMaps(state);
    getCities(INITIAL_CITY_NAMES)
        .then((cities) => {
            addCitiesToState(state, ...cities);
        })
        .catch((reason) => {
            displayError('Error: ' + reason);
        });

    plot();
});

function plot() {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const data1 = [1, 2, 3, 4, 5].map((y, yIndex) => {
        return {x: xs[yIndex], y: y};
    });
    const data2 = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((y, yIndex) => {
        return {x: xs[yIndex], y: y};
    });

    const datasets = [{
        label: 'label1',
        data: data1,
        borderColor: PostUtil.CHART_COLORS_DIVERSE[0],
        backgroundColor: PostUtil.CHART_COLORS_DIVERSE[0]
    }, {
        label: 'label2',
        data: data2,
        borderColor: PostUtil.CHART_COLORS_DIVERSE[1],
        backgroundColor: PostUtil.CHART_COLORS_DIVERSE[1]
    },];

    PostUtil.clearChart('my-chart');
    // noinspection JSUnusedGlobalSymbols
    const chartParams = {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            scales: {
                xAxes: [{
                    type: 'linear',
                    position: 'bottom',
                    scaleLabel: {
                        display: true,
                        labelString: 'my-x-label'
                    }
                }],
                yAxes: [{
                    type: 'logarithmic',
                    ticks: {
                        min: 0,
                        max: 1000,
                        callback: value => value.toFixed(2)
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'my-y-label'
                    }
                }]
            }
        }
    };
    new Chart('my-chart', chartParams);
}

function displayError(message) {
    if (message == null) {
        message = 'Something went wrong with the Google Maps API. Please try reloading the page';
    }
    $('#post-error').show().html(message);
    console.error(message);
}

function initMaps(state) {
    CITY_MAP = new google.maps.Map(document.getElementById(CITY_MAP_ID), MAP_OPTIONS);
    CITY_MAP.mapTypes.set(CUSTOM_MAP_TYPE_ID, CUSTOM_MAP_TYPE);
    CITY_MAP.setMapTypeId(CUSTOM_MAP_TYPE_ID);

    COORDINATE_MAP = new google.maps.Map(document.getElementById(COORDINATE_MAP_ID), MAP_OPTIONS);
    COORDINATE_MAP.mapTypes.set(CUSTOM_MAP_TYPE_ID, CUSTOM_MAP_TYPE);
    COORDINATE_MAP.setMapTypeId(CUSTOM_MAP_TYPE_ID);

    // Set up a search box for the city map
    addSearchBox((city) => {
        addCitiesToState(state, city);
    });

    addRemoveCitiesControl(() => {
        clearState(state);
    });
}

function addCitiesToState(state, ...cities) {
    // Hide the potential previous error message
    $('#post-error').hide();

    state.cities.push(...cities);
    onStateUpdated(state)
        .catch((reason) => {
            displayError('Error: ' + reason);
            // Undo the update
            if (state.cities.length === cities.length) {
                clearState(state);
            } else {
                // Remove the last cities from the state
                state.cities = _.initial(state.cities, cities.length);
                // Redraw the maps and tables
                onStateUpdated(state);
            }
        });
}

function onStateUpdated(state) {
    state.cityMarkers = drawCities(state.cities, state.cityMarkers);

    return getNextMondayAt(state.cities[0].location)
        .then((departureTime) => {
            return getDurationsMatrix(state.cities, departureTime);
        })
        .then((matrix) => {
            fillTable(DURATION_TABLE_ID, state.cities, matrix, UNIT_SECONDS);
            state.mdsMarkers = drawMds(state.cities, state.mdsMarkers, matrix);
        });
}

function clearState(state) {
    // Clears the cities, markers and tables
    state.cityMarkers.forEach((marker) => {
        marker.setMap(null)
    });
    state.mdsMarkers.forEach((marker) => {
        marker.setMap(null)
    });
    state.cities = [];
    state.cityMarkers = [];
    state.mdsMarkers = [];
    clearTable(DISTANCE_TABLE_ID);
    clearTable(DURATION_TABLE_ID);
}

function drawCities(cities, existingMarkers) {
    existingMarkers.forEach((marker) => {
        marker.setMap(null)
    });
    const markers = setMarkers(CITY_MAP, cities);

    // Fill the distance table
    const distanceMatrix = [];
    for (let i = 0; i < cities.length; i++) {
        distanceMatrix[i] = [];
        for (let j = 0; j < cities.length; j++) {
            distanceMatrix[i][j] = getDistanceFromLatLonInKm(
                cities[i].location.lat(),
                cities[i].location.lng(),
                cities[j].location.lat(),
                cities[j].location.lng());
        }
    }
    fillTable(DISTANCE_TABLE_ID, cities, distanceMatrix, UNIT_KILOMETERS);
    return markers;
}

function drawMds(cities, existingMarkers, durationsMatrix) {
    let mdsCities = getMdsCities(cities, durationsMatrix);

    existingMarkers.forEach((marker) => {
        marker.setMap(null)
    });

    // Update the mds markers
    return setMarkers(COORDINATE_MAP, mdsCities);
}

function getMdsCities(cities, durationsMatrix) {
    if (cities.length <= 2) {
        return cities.map((city) => {
            return {name: city.name, location: city.location};
        });
    }

    durationsMatrix = new mlMatrix.Matrix(durationsMatrix);

    // Normalize the matrix to [0, 1], as there is no useful conversion between public transport
    // time and geographic coordinates anyways.
    const matrixNormalized = mlMatrix.Matrix.div(
        mlMatrix.Matrix.sub(durationsMatrix, durationsMatrix.min()),
        durationsMatrix.max() - durationsMatrix.min());

    const coordinatesGaussNewton = getMdsCoordinatesWithGaussNewton(matrixNormalized);
    const coordinatesGd = getMdsCoordinatesWithGradientDescent(matrixNormalized);
    const coordinatesMomentum = getMdsCoordinatesWithGradientDescent(matrixNormalized, {
        lr: 0.5,
        momentum: 0.5
    });
    const coordinatesClassic = getMdsCoordinatesClassic(matrixNormalized);

    console.log('Final Gauss-Newton loss: ' + getMdsLoss(matrixNormalized, coordinatesGaussNewton));
    console.log('Final GD loss: ' + getMdsLoss(matrixNormalized, coordinatesGd));
    console.log('Final Momentum loss: ' + getMdsLoss(matrixNormalized, coordinatesMomentum));
    console.log('Final classic loss:' + getMdsLoss(matrixNormalized, coordinatesClassic));

    const coordinatesFit = fitCoordinatesToCities(coordinatesGd, cities);

    // Convert the coordinates to google maps LatLng objects
    return cities.map((city, cityIndex) => {
        const location = new google.maps.LatLng(
            coordinatesFit.get(cityIndex, 0),
            coordinatesFit.get(cityIndex, 1)
        );
        return {name: city.name, location: location};
    });
}

function getMdsCoordinatesWithGaussNewton(distances,
                                          {
                                              lr = 0.1,
                                              maxSteps = 200,
                                              minLossDifference = 1e-7,
                                              logEvery = 10
                                          } = {}) {
    const numCoordinates = distances.rows;
    let coordinates = getInitialMdsCoordinates(numCoordinates);
    const dimensions = coordinates.columns;

    let lossPrev = null;

    for (let step = 0; step < maxSteps; step++) {
        const loss = getMdsLoss(distances, coordinates);

        // Check if we should early stop.
        if (lossPrev != null && Math.abs(lossPrev - loss) < minLossDifference) {
            return coordinates;
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

        lossPrev = loss;
    }

    return coordinates;
}

function getMdsCoordinatesWithGradientDescent(distances,
                                              {
                                                  lr = 1,
                                                  maxSteps = 200,
                                                  minLossDifference = 1e-7,
                                                  momentum = 0,
                                                  logEvery = 10
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

    let lossPrev = null;
    let accumulation = null;

    for (let step = 0; step < maxSteps; step++) {
        const loss = getMdsLoss(distances, coordinates);

        // Check if we should early stop.
        if (lossPrev != null && Math.abs(lossPrev - loss) < minLossDifference) {
            return coordinates;
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

        lossPrev = loss;
    }

    return coordinates;
}

function getInitialMdsCoordinates(numCoordinates, dimensions = 2) {
    // Initialize the solution by sampling from a uniform distribution, which only allows distances
    // in [0, 1].
    return mlMatrix.Matrix.div(
        mlMatrix.Matrix.rand(numCoordinates, dimensions),
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
    const jacobian = mlMatrix.Matrix.zeros(numCoordinates * numCoordinates, numCoordinates * dimensions);

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

function fitCoordinatesToCities(coordinates, cities) {
    const cityCoordinatesArray = cities.map(function (city) {
        return [city.location.lat(), city.location.lng()];
    });
    const cityCoordinates = new mlMatrix.Matrix(cityCoordinatesArray);

    const coordinatesT = coordinates.transpose();
    const cityCoordinatesT = cityCoordinates.transpose();

    const errorBefore = getSimilarityTransformationError(coordinatesT, cityCoordinatesT);
    console.log(errorBefore);
    const errorBound = getSimilarityTransformationErrorBound(coordinatesT, cityCoordinatesT, true);
    console.log(errorBound);
    const coordinatesFitT = getSimilarityTransformation(coordinatesT, cityCoordinatesT, true);
    const errorAfter = getSimilarityTransformationError(coordinatesFitT, cityCoordinatesT);
    console.log(errorAfter);

    return coordinatesFitT.transpose();
}

function getDurationsMatrix(cities, departureTime) {
    const origins = cities.map((city) => {
        return city.name;
    });

    return new Promise((resolve, reject) => {
        DISTANCE_MATRIX_SERVICE.getDistanceMatrix({
            origins: origins,
            destinations: origins,
            travelMode: google.maps.TravelMode.TRANSIT,
            drivingOptions: {
                departureTime: departureTime,
            },
            transitOptions: {
                departureTime: departureTime,
            }
        }, (response, status) => {
            if (status !== google.maps.DistanceMatrixStatus.OK) {
                reject('GoogleMaps could not compute the travel times between all cities.');
                return;
            }

            // Build the distance matrix. Rows in the response correspond to the cities in origins.
            const matrix = [];
            for (let rowIndex = 0; rowIndex < response.rows.length; rowIndex++) {
                const row = [];
                const numColumns = response.rows[rowIndex].elements.length;
                for (let columnIndex = 0; columnIndex < numColumns; columnIndex++) {
                    if (rowIndex === columnIndex) {
                        row.push(0);
                        continue;
                    }
                    const element = response.rows[rowIndex].elements[columnIndex];
                    if (element.status !== google.maps.DistanceMatrixElementStatus.OK) {
                        reject(`GoogleMaps could not find a public transport connection from` +
                            ` ${cities[rowIndex].name} to ${cities[columnIndex].name}.`);
                        return;
                    }
                    row.push(element.duration.value);
                }
                matrix.push(row);
            }
            resolve(matrix);
        });
    });
}

function fillTable(id, cities, matrix, unit) {
    clearTable(id);

    // Compute the range of values for coloring the cells correspondingly.
    const range = {
        min: getMinOfArray(matrix),
        max: getMaxOfArray(matrix)
    };

    // Create the table
    const table = document.getElementById(id);

    // Create the header
    const headerRow = document.createElement('tr');

    // Add the upper left cell to the header
    const upperLeftCell = document.createElement('th');
    upperLeftCell.appendChild(document.createTextNode('From \\ To'));
    headerRow.appendChild(upperLeftCell);

    // Add each city to the header
    for (const city of cities) {
        const dataColumnHeader = document.createElement('th');
        dataColumnHeader.appendChild(document.createTextNode(city.name));
        headerRow.appendChild(dataColumnHeader);
    }
    table.appendChild(headerRow);

    // Add the table rows
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
        const dataRow = document.createElement('tr');

        // Add the city name to the left of the row
        const dataRowHeader = document.createElement('th');
        dataRowHeader.appendChild(document.createTextNode(cities[rowIndex].name));
        dataRow.appendChild(dataRowHeader);

        // Add the row values
        for (let columnIndex = 0; columnIndex < matrix[rowIndex].length; columnIndex++) {
            const cellValue = matrix[rowIndex][columnIndex];
            const dataCell = document.createElement('td');

            // Set the text depending on the position and unit
            let text = '-';
            if (rowIndex !== columnIndex) {
                if (unit === UNIT_SECONDS) {
                    text = secondsToString(cellValue);
                } else if (unit === UNIT_KILOMETERS) {
                    text = Math.round(cellValue) + ' km';
                } else {
                    throw Error('Unknown unit ' + unit);
                }
            }

            // Append the cell to the row
            dataCell.style.backgroundColor = getCellColor(matrix[rowIndex][columnIndex], range);
            dataCell.appendChild(document.createTextNode(text));
            dataRow.appendChild(dataCell);
        }
        table.appendChild(dataRow);
    }
}

function getNextMondayAt(latLng) {
    // Get monday 12 pm in the time zone of the given location, but converted to UTC.
    const dayOfWeek = 1;
    const now = new Date();

    // Get the UTC offset at the location on Monday 12 pm UTC. It would be better to get it
    // at 12 pm in the time zone of the given location, but the Google Time Zone API expects a
    // UTC time stamp and we don't know yet how to convert the time zone of the given location to
    // UTC. So, if on exactly that Monday, the daylight savings time changes in the given location,
    // the result might be off by 1 hour.
    const mondayUTC = new Date();
    // The -1 and +1 ensure that we go to the next monday, even if now's UTC day is monday.
    const dayDelta = (dayOfWeek + 7 - now.getUTCDay() - 1) % 7 + 1;
    mondayUTC.setUTCDate(mondayUTC.getUTCDate() + dayDelta);
    mondayUTC.setUTCHours(12, 0, 0, 0);

    return $.get('https://maps.googleapis.com/maps/api/timezone/json',
        {
            location: `${latLng.lat()},${latLng.lng()}`,
            timestamp: (mondayUTC.getTime() / 1000).toString(),
            key: 'AIzaSyDZl5Gnv4_UUuWRvaGcjo_sn-XIKwCSHnA'
        })
        .then((result) => {
            if (result.status !== 'OK') {
                // noinspection JSUnresolvedVariable
                throw Error(result.errorMessage);
            }
            // noinspection JSUnresolvedVariable
            const offsetMillis = 1000 * (result.rawOffset + result.dstOffset);
            return new Date(mondayUTC.getTime() - offsetMillis);
        });
}

function getCellColor(value, range) {
    let progress = (value - range.min) / (range.max - range.min);
    // Clip the progress
    progress = Math.max(0, Math.min(1, progress));
    return 'rgba(255,170,170,' + progress + ')';
}

function secondsToString(seconds) {
    if (seconds < 60)
        return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    return ((hours > 0 ? hours + ' h ' : '') + minutes + ' min');
}

function clearTable(id) {
    let table = document.getElementById(id);
    while (table.firstChild != null) {
        table.removeChild(table.firstChild);
    }
}

function setMarkers(map, cities, fitBounds = true) {
    // Set a marker for each city while extending the bounds
    const bounds = new google.maps.LatLngBounds();
    const markers = [];
    for (const city of cities) {
        const marker = setMarker(map, city.name, city.location);
        markers.push(marker);
        bounds.extend(city.location);
    }

    if (fitBounds) {
        map.fitBounds(bounds);
    }

    return markers;
}

function setMarker(map, name, position) {
    // noinspection JSCheckFunctionSignatures
    return new MarkerWithLabel({
        position: position,
        draggable: false,
        raiseOnDrag: false,
        map: map,
        labelContent: name,
        labelAnchor: new google.maps.Point(22, 0),
        labelClass: 'labels' // the CSS class for the label
    });
}

function getCityNameForPlace(place) {
    // Iterate the address components until one is of type 'locality'
    for (const component of place.address_components) {
        if (component.types[0] === 'locality') {
            return component.long_name;
        }
    }
    return place.address_components[0].long_name;
}

function getCities(cityNames) {
    const geocodePromises = [];
    for (const cityName of cityNames) {
        const promise = new Promise((resolve, reject) => {
            GEOCODER.geocode({
                'address': cityName
            }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    const city = {
                        name: cityName,
                        location: results[0].geometry.location
                    };
                    resolve(city);
                } else {
                    reject('GoogleMaps could not geocode all city names.');
                }
            })
        });
        geocodePromises.push(promise);
    }

    return Promise.all(geocodePromises);
}

function addSearchBox(onEnter) {
    const input = document.getElementById('pac-input');

    // noinspection JSCheckFunctionSignatures
    const searchBox = new google.maps.places.SearchBox(input);
    CITY_MAP.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Only show the search box, when the map has loaded.
    google.maps.event.addListenerOnce(CITY_MAP, 'idle', () => {
        input.style.display = 'block';
    });

    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    searchBox.addListener('places_changed', function () {
        const places = searchBox.getPlaces();
        if (places.length === 0) {
            return;
        }

        const place = places[0];
        if (place != null && place.address_components != null) {
            const city = {
                name: getCityNameForPlace(place),
                location: place.geometry.location
            };
            onEnter(city);
        }
    });
}

function addRemoveCitiesControl(onClick) {
    // Create the DIV to hold the control
    const controlDiv = document.createElement('div');

    // Set CSS for the control border.
    const controlUI = document.createElement('div');
    controlUI.style.backgroundColor = '#fff';
    controlUI.style.border = '2px solid #fff';
    controlUI.style.borderRadius = '3px';
    controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
    controlUI.style.cursor = 'pointer';
    controlUI.style.marginBottom = '22px';
    controlUI.style.textAlign = 'center';
    controlUI.style.marginRight = '12px';
    controlUI.style.marginTop = '12px';
    controlUI.title = 'Click to remove all markers from the map';
    controlDiv.appendChild(controlUI);

    // Set CSS for the control interior.
    const controlText = document.createElement('div');
    controlText.style.color = 'rgb(25,25,25)';
    controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
    controlText.style.fontSize = '13px';
    controlText.style.lineHeight = '24px';
    controlText.style.paddingLeft = '5px';
    controlText.style.paddingRight = '5px';
    controlText.innerHTML = 'Remove Cities';
    controlUI.appendChild(controlText);

    // Setup the click event listener
    controlUI.addEventListener('click', onClick);

    controlDiv.index = 1;
    CITY_MAP.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
}
