const INITIAL_CITY_NAMES = ['San Francisco', 'Sacramento', 'Los Angeles', 'Las Vegas'];

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
});

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

    return getDurationsMatrix(state.cities)
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

    // Normalize the matrix to [0, 1], as there is no useful conversion between public transport
    // time and geographic coordinates anyways.
    const maxDistance = getMaxOfArray(durationsMatrix);
    const minDistance = getMinOfArray(durationsMatrix);
    const matrixNormalized = numeric.div(
        numeric.sub(durationsMatrix, minDistance),
        maxDistance - minDistance);

    getMdsCoordinatesWithGradientDescent(matrixNormalized);
    const coordinatesRaw = getMdsCoordinatesClassic(matrixNormalized);
    console.log(getMdsLoss(matrixNormalized, coordinatesRaw));

    const coordinatesFit = fitCoordinatesToCities(coordinatesRaw, cities);

    // Convert the coordinates to google maps LatLng objects
    return cities.map((city, cityIndex) => {
        const location = new google.maps.LatLng(
            coordinatesFit[cityIndex][0],
            coordinatesFit[cityIndex][1]
        );
        return {name: city.name, location: location};
    });
}

function getMdsCoordinatesWithGradientDescent(distances,
                                              lr = 0.1,
                                              maxSteps = 200,
                                              minImprovement = 1e-6,
                                              logEvery = 20) {
    // TODO: Second order optimization
    // TODO: Use TensorFlow to ensure that gradients are correct

    const numCoords = distances.length;
    let coordinates = getInitialMdsCoordinates(numCoords);

    let lossPrev = null;

    for (let step = 0; step < maxSteps; step++) {
        const loss = getMdsLoss(distances, coordinates);

        // Check if we should early stop.
        if (lossPrev != null && lossPrev - loss < minImprovement) {
            return coordinates;
        }

        if (logEvery > 0 && step % logEvery === 0) {
            console.log(`Step: ${step}, loss: ${loss}`);
        }

        // Apply the gradient for each coordinate.
        for (let coordIndex = 0; coordIndex < numCoords; coordIndex++) {
            const gradient = getGradientForCoordinate(distances, coordinates, coordIndex);
            const update = numeric.mul(-lr, gradient);
            coordinates[coordIndex] = numeric.add(coordinates[coordIndex], update);
        }

        lossPrev = loss;
    }

    return coordinates;
}

function getInitialMdsCoordinates(numCoordinates, dimensions = 2) {
    // Initialize the solution by sampling from a uniform distribution, which only allows distances
    // in [0, 1].
    const coordinates = [];
    for (let coordinateIndex = 0; coordinateIndex < numCoordinates; coordinateIndex++) {
        const coordinate = [];
        for (let dimensionIndex = 0; dimensionIndex < dimensions; dimensionIndex++) {
            coordinate.push(Math.random() / Math.sqrt(dimensions));
        }
        coordinates.push(coordinate);
    }
    return coordinates;
}

function getMdsLoss(distances, coordinates) {
    // Average the squared differences of actual distances and computed distances
    let loss = 0;
    for (let coordIndex1 = 0; coordIndex1 < coordinates.length; coordIndex1++) {
        for (let coordIndex2 = 0; coordIndex2 < coordinates.length; coordIndex2++) {
            if (coordIndex1 === coordIndex2) continue;

            const coord1 = coordinates[coordIndex1];
            const coord2 = coordinates[coordIndex2];
            const target = distances[coordIndex1][coordIndex2];
            const actual = numeric.norm2(numeric.sub(coord1, coord2));
            loss += Math.pow(target - actual, 2) / coordinates.length;
        }
    }
    return loss;
}

function getGradientForCoordinate(distances, coordinates, coordIndex) {
    const coord = coordinates[coordIndex];
    let gradient = [0, 0];

    for (let otherCoordIndex = 0; otherCoordIndex < coordinates.length; otherCoordIndex++) {
        if (coordIndex === otherCoordIndex) continue;

        const otherCoord = coordinates[otherCoordIndex];
        const squaredDifferenceSum = numeric.sum(numeric.pow(numeric.sub(coord, otherCoord), 2));
        const actual = Math.sqrt(squaredDifferenceSum);
        const targets = [
            distances[coordIndex][otherCoordIndex],
            distances[otherCoordIndex][coordIndex]
        ];

        for (const target of targets) {
            const lossWrtActual = -2 * (target - actual) / coordinates.length;
            const actualWrtSquaredDifferenceSum = 0.5 / Math.sqrt(squaredDifferenceSum);
            const squaredDifferenceSumWrtCoord = numeric.mul(2, numeric.sub(coord, otherCoord));
            const lossWrtCoord = numeric.mul(
                lossWrtActual * actualWrtSquaredDifferenceSum,
                squaredDifferenceSumWrtCoord
            );
            gradient = numeric.add(gradient, lossWrtCoord);
        }
    }

    return gradient;
}

function fitCoordinatesToCities(coordinates, cities) {
    // Following http://stackoverflow.com/questions/13432805/finding-translation-and-scale-on-two-sets-of-points-to-get-least-square-error-in
    const cityCoordinates = cities.map(function (city) {
        return [city.location.lat(), city.location.lng()];
    });

    // Center both coordinates
    const cityCenter = reduceMean(cityCoordinates);
    const coordinatesCentered = getCenteredCoordinates(coordinates);
    const cityCoordinatesCentered = getCenteredCoordinates(cityCoordinates);

    let X = numeric.dot(numeric.transpose(coordinatesCentered), coordinatesCentered);
    // TODO: NEVER USE THE INVERSE!!!!!
    X = numeric.inv(X);
    X = numeric.dot(X, numeric.transpose(coordinatesCentered));
    X = numeric.dot(X, cityCoordinatesCentered);

    const coordinatesCenteredFit = numeric.dot(coordinatesCentered, X);

    // Move the coordinates to the center of the cities
    return coordinatesCenteredFit.map((coordinate) => {
        return numeric.add(coordinate, cityCenter);
    });
}

function getCenteredCoordinates(coordinates) {
    let center = reduceMean(coordinates);
    return coordinates.map((coordinate) => {
        return numeric.sub(coordinate, center);
    });
}

function reduceMean(array) {
    // Computes the mean over the first axis of array
    return numeric.div(numeric.add.apply(null, array), array.length);
}

function getDurationsMatrix(cities) {
    const origins = cities.map((city) => {
        return city.name;
    });

    return new Promise((resolve, reject) => {
        DISTANCE_MATRIX_SERVICE.getDistanceMatrix({
            origins: origins,
            destinations: origins,
            travelMode: google.maps.TravelMode.TRANSIT
        }, (response, status) => {
            if (status !== google.maps.DistanceMatrixStatus.OK) {
                reject('GoogleMaps could not compute the travel times between all cities.');
                return;
            }

            // Build the distance matrix
            const matrix = [];
            for (let i = 0; i < response.rows.length; i++) {
                const row = [];
                for (let j = 0; j < response.rows[i].elements.length; j++) {
                    if (i === j) {
                        row.push(0);
                        continue;
                    }
                    const element = response.rows[i].elements[j];
                    if (element.status !== google.maps.DistanceMatrixElementStatus.OK) {
                        reject('GoogleMaps could not find a public transport connection' +
                            ' between ' + cities[i].name + ' and ' + cities[j].name + '.');
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

    // Add the empty upper left cell to the header
    headerRow.appendChild(document.createElement('th'));

    // Add each city to the header
    for (const city of cities) {
        const th = document.createElement('th');
        th.appendChild(document.createTextNode(city.name));
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // Add the table rows
    for (let i = 0; i < matrix.length; i++) {
        const tr = document.createElement('tr');

        // Add the city name to the left of the row
        const td = document.createElement('th');
        td.appendChild(document.createTextNode(cities[i].name));
        tr.appendChild(td);

        // Add the row values
        for (let j = 0; j < matrix[i].length; j++) {
            const cellValue = matrix[i][j];
            const td = document.createElement('td');

            // Set the text depending on the position and unit
            let text = '-';
            if (i !== j) {
                if (unit === UNIT_SECONDS) {
                    text = secondsToString(cellValue);
                } else if (unit === UNIT_KILOMETERS) {
                    text = Math.round(cellValue) + ' km';
                } else {
                    throw Error('Unknown unit ' + unit);
                }
            }

            // Append the cell to the row
            td.style.backgroundColor = getCellColor(matrix[i][j], range);
            td.appendChild(document.createTextNode(text));
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

// noinspection JSUnusedGlobalSymbols
function getNextMonday() {
    // Following https://stackoverflow.com/a/33078673/2628369
    const dayOfWeek = 1;
    const now = new Date();
    const resultDate = new Date();
    resultDate.setDate(resultDate.getDate() + (dayOfWeek + 7 - now.getDay()) % 7);
    resultDate.setHours(12);
    resultDate.setMinutes(0);
    resultDate.setSeconds(0);
    resultDate.setMilliseconds(0);
    return resultDate;
}

function getCellColor(value, range) {
    let progress = (value - range.min) / (range.max - range.min);
    // Clip the progress
    progress = Math.max(0, Math.min(1, progress));
    return 'rgba(255,200,200,' + progress + ')';
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
