var cityNames = [];
var cityMarkers = [];
var coordinateMarkers = [];

window.onContentReadyCallbacks.push(function () {
    cityNames = ["San Francisco", "Sacramento", "Los Angeles", "Las Vegas"];
    cityMarkers = [];
    coordinateMarkers = [];

    try {
        initMap();
    } catch (e) {
        // Display the error beneath the interactive google maps
        displayError();
    }
});

function displayError(message) {
    message = message || "Something went wrong with the Google Maps API. Please try reloading" +
        " the page";
    $("#post-error").show().html(message);
}

function getCityCoordinates(cityNames, callback) {
    var result = [];
    var geocoder = new google.maps.Geocoder();
    cityNames.forEach(function(city) {
        geocoder.geocode({
            'address': city
        }, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                result.push({
                    name: city,
                    location: results[0].geometry.location
                });
                if (result.length == cityNames.length && callback) {
                    callback(result);
                }
            } else {
                displayError();
            }
        })
    });
}

function drawCities() {
    clearMarkers(cityMarkers);

    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < cities.length; i++) {
        setMarker(cityMap, cities[i].name, cities[i].location);
        bounds.extend(cities[i].location);
    }
    cityMap.fitBounds(bounds);

    // fill the distance table
    var distanceRange = {
        min: Number.MAX_VALUE,
        max: 0
    };
    var distances = [];
    for (var i = 0; i < cities.length; i++) {
        distances[i] = [];
        for (var j = 0; j < cities.length; j++) {
            // set the distance
            distances[i][j] = getDistanceFromLatLonInKm(cities[i].location.lat(), cities[i].location.lng(), cities[j].location.lat(), cities[j].location.lng());

            if (i != j) {
                // update the distance range (ignore zero values for coloring)
                if (distances[i][j] < distanceRange.min)
                    distanceRange.min = distances[i][j];
                if (distances[i][j] > distanceRange.max)
                    distanceRange.max = distances[i][j];
            }
        }
    }
    fillTable("distance-table", distances, " km", distanceRange);
}

function drawGraph(geocoder) {
    getDurations(geocoder, function(matrix) {
        var coordinates = getMdsCoordinates(matrix);

        // scale the coordinates to google maps
        coordinates = fitCoordinates(coordinates);
        var cityCoordinates = cities.map(function(city) {
            return [city.location.lat(), city.location.lng()];
        });
        var error = getMeanEuclideanError(coordinates, cityCoordinates);

        clearMarkers(coordinateMarkers);

        var bounds = new google.maps.LatLngBounds();
        // iterate through the cities and display the calculated coordinates
        for (var i = 0; i < cities.length; i++) {
            var position = new google.maps.LatLng(coordinates[i][0], coordinates[i][1]);
            // set the marker
            setMarker(coordinateMap, cities[i].name, position);
            bounds.extend(position);
        }
        coordinateMap.fitBounds(bounds);
    });
}

function setMarker(map, name, position) {
    var marker = new MarkerWithLabel({
        position: position,
        draggable: false,
        raiseOnDrag: false,
        map: map,
        labelContent: name,
        labelAnchor: new google.maps.Point(22, 0),
        labelClass: "labels" // the CSS class for the label
    });
    if (map == cityMap)
        cityMarkers.push(marker);
    else
        coordinateMarkers.push(marker);
}

/** http://stackoverflow.com/questions/13432805/finding-translation-and-scale-on-two-sets-of-points-to-get-least-square-error-in **/
function fitCoordinates(coordinates) {
    var cityCoordinates = cities.map(function(city) {
        return [city.location.lat(), city.location.lng()];
    });

    // center both coordinates
    var cityCenter = mean(cityCoordinates);
    center(coordinates);
    center(cityCoordinates);

    var X = numeric.dot(numeric.transpose(coordinates), coordinates);
    X = numeric.inv(X);
    X = numeric.dot(X, numeric.transpose(coordinates));
    X = numeric.dot(X, cityCoordinates);

    coordinates = numeric.dot(coordinates, X);

    // translate the coordinates to the center of the cities
    for (var i = 0; i < coordinates.length; i++) {
        coordinates[i] = numeric.add(coordinates[i], cityCenter);
    }
    return coordinates;
}

function getMeanEuclideanError(pointsA, pointsB) {
    var diffs = numeric.sub(pointsA, pointsB);
    var error = 0;
    for (var i = 0; i < diffs.length; i++) {
        error += numeric.norm2Squared(diffs[i]);
    }
    return error / diffs.length;
}

function center(points) {
    centroid = mean(points);
    for (var i = 0; i < points.length; i++) {
        points[i] = numeric.sub(points[i], centroid);
    }
}

function mean(A) {
    return numeric.div(numeric.add.apply(null, A), A.length);
}

/** from http://www.benfrederickson.com/multidimensional-scaling/ */
function getMdsCoordinates(distances) {
    // square distances
    var M = numeric.mul(-.5, numeric.pow(distances, 2));

    // double centre the rows/columns
    var rowMeans = mean(M),
        colMeans = mean(numeric.transpose(M)),
        totalMean = mean(rowMeans);

    for (var i = 0; i < M.length; ++i) {
        for (var j = 0; j < M[0].length; ++j) {
            M[i][j] += totalMean - rowMeans[i] - colMeans[j];
        }
    }

    // take the SVD of the double centred matrix, and return the
    // points from it
    var ret = numeric.svd(M),
        eigenValues = numeric.sqrt(ret.S);
    return ret.U.map(function(row) {
        return numeric.mul(row, eigenValues).splice(0, 2);
    });
}

function getDurations(geocoder, callback) {
    var service = new google.maps.DistanceMatrixService();
    var matrix = [];
    var origins = [];
    for (var i = 0; i < cities.length; i++) {
        origins.push(cities[i].name);
        matrix[i] = new Array(cities.length);
    }
    var durationRange = {
        min: Number.MAX_VALUE,
        max: 0
    };

    service.getDistanceMatrix({
        origins: origins,
        destinations: origins,
        travelMode: google.maps.TravelMode.TRANSIT,
        drivingOptions: {
            departureTime: getNextMonday(),
        }
    }, function(response, status) {
        if (status == google.maps.DistanceMatrixStatus.OK) {

            for (var i = 0; i < response.rows.length; i++) {
                var row = response.rows[i];
                for (var j = 0; j < row.elements.length; j++) {
                    if (i == j) {
                        matrix[i][j] = 0;
                        continue;
                    }

                    var element = row.elements[j];
                    if (element.status == google.maps.DistanceMatrixStatus.OK) {
                        matrix[i][j] = element.duration.value;
                        // update the duration range (ignore zero values for coloring)
                        if (element.duration.value < durationRange.min)
                            durationRange.min = element.duration.value;
                        if (element.duration.value > durationRange.max)
                            durationRange.max = element.duration.value;
                    } else {
                        displayError("GoogleMaps could not find a public transport connection" +
                            " between " + cities[i].name + " and " + cities[j].name + ".");
                        // remove the city that was last added and redraw everything
                        cities.pop();
                        drawCities();
                        drawGraph();
                    }
                }
            }
            fillTable("duration-table", matrix, "seconds", durationRange);
            callback(matrix);
        }
    });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

function deepCloneTwoDimensionalArray(array) {
    return array.map(function(arr) {
        return arr.slice();
    });
}

function clearTable(id) {
    var table = document.getElementById(id);
    // empty the table
    while (table.firstChild) {
        table.removeChild(table.firstChild);
    }
}

function fillTable(id, matrix, measurement, range) {
    clearTable(id);
    var table = document.getElementById(id);

    // create the header
    var headerRow = document.createElement('TR');
    // add the empty upper left cell
    headerRow.appendChild(document.createElement('TH'));
    for (var i = 0; i < cities.length; i++) {
        var th = document.createElement('TH');
        th.appendChild(document.createTextNode(cities[i].name));
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    for (var i = 0; i < matrix.length; i++) {
        var tr = document.createElement('TR');
        // add the city name
        var td = document.createElement('TH');
        td.appendChild(document.createTextNode(cities[i].name));
        tr.appendChild(td);

        for (var j = 0; j < matrix[i].length; j++) {
            var td = document.createElement('TD');
            var text = "-";
            if (i != j)
                text = measurement == "seconds" ? secondsToText(matrix[i][j]) : Math.round(matrix[i][j]) + " " + measurement;
            td.style.backgroundColor = getWeightedColor(matrix[i][j], range);
            td.appendChild(document.createTextNode(text));
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

function getWeightedColor(value, range) {
    var progress = Math.max(0, (value - range.min) / (range.max - range.min));
    return "rgba(255,200,200," + progress + ")";
}

function secondsToText(d) {
    if (d < 60)
        return "-";
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    return ((h > 0 ? h + " h " : "") + m + " min");
}

function getNextMonday() {
    var dayOfWeek = 1;
    var resultDate = new Date();
    resultDate.setDate(resultDate.getDate() + (7 + dayOfWeek - resultDate.getDay()) % 7);
    resultDate.setHours(12);
    resultDate.setMinutes(0);
    resultDate.setSeconds(0);
    resultDate.setMilliseconds(0);
    return resultDate;
}

function initMap() {
    var customMapType = new google.maps.StyledMapType([{
        stylers: [{
            visibility: 'simplified'
        }]
    }, {
        featureType: 'road',
        stylers: [{
            visibility: 'off'
        }]
    }, {
        "featureType": "administrative",
        "stylers": [{
            "visibility": "off"
        }]
    }, {
        "featureType": "poi",
        "stylers": [{
            "visibility": "off"
        }]
    }, {
        "featureType": "administrative.country",
        "elementType": "geometry.stroke",
        "stylers": [{
            "visibility": "on"
        }]
    }], {
        name: 'Custom Style'
    });
    var customMapTypeId = 'custom_style';

    var mapOptions = {
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

    cityMap = new google.maps.Map(document.getElementById('city-map'), mapOptions);
    cityMap.mapTypes.set(customMapTypeId, customMapType);
    cityMap.setMapTypeId(customMapTypeId);

    // set up a search box for the city map
    addSearchBox();
    addRemoveCitiesControl();

    coordinateMap = new google.maps.Map(document.getElementById('coordinate-map'), mapOptions);

    coordinateMap.mapTypes.set(customMapTypeId, customMapType);
    coordinateMap.setMapTypeId(customMapTypeId);

    geocoder = new google.maps.Geocoder;

    getCityCoordinates(cityNames, function(result) {
        cities = result;
        drawCities();
        drawGraph();
    });
}

function clearMarkers(markers) {
    for (var i = 0; i < markers.length; i++)
        markers[i].setMap(null);
    markers = [];
}

// Deletes all markers and the cities
function removeCities() {
    clearMarkers(cityMarkers);
    clearMarkers(coordinateMarkers);
    cities = [];
    // clear the tables
    clearTable("distance-table");
    clearTable("duration-table");
}

function addSearchBox() {
    var input = document.getElementById('pac-input');
    var searchBox = new google.maps.places.SearchBox(input);
    cityMap.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    searchBox.addListener('places_changed', function() {
        var place = searchBox.getPlaces()[0];
        if (place) {
            // Hide the potential previous error message
            $("#post-error").hide();

            cities.push({
                name: getCityForPlace(place),
                location: place.geometry.location
            });
            drawCities();
            if (cities.length >= 3)
                drawGraph();
        }
    });
}

function getCityForPlace(place) {
    // iterate the address components
    for (var i = 0; i < place.address_components.length; i++) {
        var types = place.address_components[i].types;
        if (types[0] == "locality")
            return place.address_components[i].long_name;
    }
    return place.address_components[0].long_name;
}

function addRemoveCitiesControl() {
    // Create the DIV to hold the control and call the CenterControl() constructor
    // passing in this DIV.
    var controlDiv = document.createElement('div');
    var control = new RemoveCitiesControl(controlDiv, cityMap);

    controlDiv.index = 1;
    cityMap.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
}

function RemoveCitiesControl(controlDiv, map) {

    // Set CSS for the control border.
    var controlUI = document.createElement('div');
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
    var controlText = document.createElement('div');
    controlText.style.color = 'rgb(25,25,25)';
    controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
    controlText.style.fontSize = '13px';
    controlText.style.lineHeight = '24px';
    controlText.style.paddingLeft = '5px';
    controlText.style.paddingRight = '5px';
    controlText.innerHTML = 'Remove Cities';
    controlUI.appendChild(controlText);

    // Setup the click event listeners: simply set the map to Chicago.
    controlUI.addEventListener('click', function() {
        removeCities();
    });

}
