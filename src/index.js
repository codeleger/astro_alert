// !!! Use this code at your own risk !!!
//
//INTRODUCTION
//
// see README.md

const fetch = require("node-fetch");

var jsonData;
var http = require('http');
var result = null;

var url = require('url');
var meteo_error = false;

var debug = false; //set true for debug output.
var debug_response;


http.createServer(function (req, res) {
    console.log("------------------------------------------------------------");
    var url_parts = url.parse(req.url, true);

    if (url_parts.query.place_id) {
        //DEBUG
        if (debug) console.log("url parameter place_id:" + url_parts.query.place_id);

        var url_place_id = url_parts.query.place_id;
    }
    if (url_parts.query.lat && url_parts.query.lon) {
        //DEBUG
        if (debug) console.log("url parameter lat: " + url_parts.query.lat);
        if (debug) console.log("url parameter lon:" + url_parts.query.lon);

        url_lat = url_parts.query.lat;
        url_lon = url_parts.query.lon;
    }
    if (url_parts.query.key) {
        //DEBUG
        if (debug) console.log("url parameter key:" + url_parts.query.key);

        url_key = url_parts.query.key;
    }
    console.log(`Just got a request at ${req.url}!`);

    // check if required parameters have been provided.
    if (typeof url_key !== 'undefined' && (typeof url_place_id !== 'undefined' || (typeof url_lat !== 'undefined' && typeof url_lon !== 'undefined'))) {
        //DEBUG
        if (debug) console.log(`request has valid parameters`);

        var meteo_url;
        //build the url to call weather api with either place_id or lat / long 
        if (typeof url_key !== 'undefined' && typeof url_place_id !== 'undefined') {
            meteo_url = "https://www.meteosource.com/api/v1/free/point?place_id=" + url_place_id + "&sections=daily,hourly&language=en&units=metric&key=" + url_key;
        }
        else if (typeof url_key !== 'undefined' && typeof url_lat !== 'undefined' && typeof url_lon !== 'undefined') {
            meteo_url = "https://www.meteosource.com/api/v1/free/point?lat=" + url_lat + "&lon=" + url_lon + "&sections=daily,hourly&language=en&units=metric&key=" + url_key;
        }

        //Debug   
        //console.log("meteo_url = "+ meteo_url);  
        fetch(meteo_url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error, status = ${response.status}`);
                }
                debug_response = response;
                return response.json();
            })
            .then(data => {
                var jsonData = data;

                //TODO further improvement potential make it configurable via URL parameter.
                // Set the desired low cloud coverage threshold (in percentage)
                var lowCloudCoverageThreshold = 20;

                //TODO further improvement potential make it configurable via URL parameter.
                // Set the desired consecutive hours threshold
                var consecutiveHoursThreshold = 3;

                // Initialize variables
                var consecutiveHours = 0;
                var isDarkHours = false;
                var hasLowCloudCoverage = false;
                var clearSkiesPeriods = [];

                var darkHoursPeriodStartDay = 0;
                var today_date = 0;
                var tomorrow_date = 0;
                // Iterate over the hourly data
                for (var i = 0; i < jsonData.hourly.data.length; i++) {
                    var hourlyData = jsonData.hourly.data[i];
                    var cloudCoverage = hourlyData.cloud_cover.total;
                    var hour = new Date(hourlyData.date).getHours();
                    var day = new Date(hourlyData.date).getDate();

                    if (today_date == 0) { today_date = new Date(hourlyData.date); }
                    if (today_date.getDate() != day && tomorrow_date == 0) { tomorrow_date = new Date(hourlyData.date); }

                    // Check if it's dark hours (between 18:00 and 6:00) 
                    //TODO further improvement potential make it dynamically to location / astronomical darkness
                    if (hour >= 18 || hour < 6) {
                        if (isDarkHours == false) {
                            darkHoursPeriodStartDay = day;
                        }
                        isDarkHours = true;
                    } else {
                        isDarkHours = false;
                    }

                    // Check if the cloud coverage is low
                    if (cloudCoverage <= lowCloudCoverageThreshold && isDarkHours) {

                        hasLowCloudCoverage = true;
                        consecutiveHours++;

                        // Check if there are consecutive hours with low cloud coverage
                        if (consecutiveHours >= consecutiveHoursThreshold) {
                            clearSkiesPeriods.push(darkHoursPeriodStartDay);
                        }
                    } else {
                        hasLowCloudCoverage = false;
                        consecutiveHours = 0;
                    }

                    if (debug) {
                        console.log(`Hour: ${hour} , day: ${day}, cloudcoverage: ${cloudCoverage}, isDarkHours : ${isDarkHours}, hasLowCloudCoverage : ${hasLowCloudCoverage}, `);
                    }
                }

                if (clearSkiesPeriods.length > 0) {
                    clear_today = false;
                    clear_tomorrow = false;
                    //console.log(today_date);
                    //console.log(tomorrow_date);
                    i = 0;
                    while (i < clearSkiesPeriods.length) {

                        // console.log(clearSkiesPeriods[i]);
                        //console.log(today_date.getDate());

                        if (clearSkiesPeriods[i] == today_date.getDate()) {
                            clear_today = true;
                        }
                        if (clearSkiesPeriods[i] == tomorrow_date.getDate()) {
                            clear_tomorrow = true;
                        }
                        i++;
                    }
                    result = {
                        "clear_skies_periods": clearSkiesPeriods,
                        "clear_today": clear_today,
                        "clear_tomorrow": clear_tomorrow
                    };
           
                    //console.log(JSON.stringify(result));
                }
				 //console.log("meteosource response:", fetchresp.status);
				if (meteo_error) {
					console.log(`Error: Error in Meteo API call.`);
					//console.log("meteosource response:", fetchresp.status);
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end("Error: Error in Meteo API call.");
				}
				else {
				

					res.writeHead(200, { 'Content-Type': 'application/json' });
					console.log(JSON.stringify(result));
					res.end(JSON.stringify(result));
				}
                console.log("finished..exiting");
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                console.log("ERROR");
                meteo_error = true;
            });
       

    }
    else {
        console.log(`At least one parameter missing`);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end("Error: you must provide parameter key and one of the following: place_id or lat+lon.");
    }

}).listen(process.env.PORT || 3000);
