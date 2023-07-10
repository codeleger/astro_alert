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

const SunCalc = require('suncalc');

var debug = false; //set true for debug output.
var debug_periods = false;//set true for debug output for darkskies periods.

var debug_response;

var   times_today;
var   times_tomorrow;
var   times_dayaftertomorrow;


//TODO 
// - modularize code for better readability and maintainability
// - improved error handling // catching

http.createServer(function (req, res) {

    handlehttprequest(req,res);

}).listen(process.env.PORT || 3000);

async function handlehttprequest(req, res)
{
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
            meteo_url = "https://www.meteosource.com/api/v1/free/point?place_id=" + url_place_id + "&sections=daily,hourly&language=en&units=metric&timezone=UTC&key=" + url_key;           
        }
        else if (typeof url_key !== 'undefined' && typeof url_lat !== 'undefined' && typeof url_lon !== 'undefined') {
            //TODO format check error handling for lat lon
            meteo_url = "https://www.meteosource.com/api/v1/free/point?lat=" + url_lat + "&lon=" + url_lon + "&sections=daily,hourly&language=en&units=metric&timezone=UTC&key=" + url_key;
        }
        
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
                var consecutiveHoursTomorrow = 0;
                var isDarkHours = false;
                var hasLowCloudCoverage = false;
                var clearSkiesPeriods = [];

                var darkHoursPeriodStartDay = 0;
                var today_date = 0;
                var tomorrow_date = 0;

                var result_clear_today = false;
                var result_clear_tomorrow = false;

                var beg_clearskiesperiod = null;
                var end_clearskiesperiod = null;

                if(typeof jsonData.lat !== 'undefined' && typeof jsonData.lon !== 'undefined' )
                {
                    //if lat lon is in response of meteosource use this to determine nautical dusk/dawn

                    console.log("Using coordinates for timezone: lat="+jsonData.lat+",lon="+jsonData.lon);

                    //found coordinates
                    initializeDatesTimes(convertLatitudeOrLong(jsonData.lat),convertLatitudeOrLong(jsonData.lon));
                   
                }
                else
                {
                    console.log("Fallback DarkHours because couldnt be determined by lat/long.");
                    //QUICK and dirty
                    initializeDatesTimesEmpty();
                }

                // Iterate over the hourly data
                for (var i = 0; i < jsonData.hourly.data.length; i++) {
                    var hourlyData = jsonData.hourly.data[i];
                    var cloudCoverage = hourlyData.cloud_cover.total;
                    var itemdate = new Date(hourlyData.date+"Z"); //adding Z indicates time is UTC / GTM+0 --> e.g. 2023-07-07T05:00:00Z
                    var hour = new Date(hourlyData.date).getHours();
                    var day = new Date(hourlyData.date).getDate();

                    if (today_date == 0) { today_date = new Date(hourlyData.date); }
                    if (today_date.getDate() != day && tomorrow_date == 0) { tomorrow_date = new Date(hourlyData.date); }


                    //TODO PRIO 3: reduce redundant code inside the if and else if.
                    if(itemdate > times_today.nauticalDusk && itemdate < times_tomorrow.nauticalDawn) //hourly data is in the dark 
                    {
                        if( cloudCoverage <= lowCloudCoverageThreshold) //and below cloud treshold.
                        {
                            if(beg_clearskiesperiod == null){
                                beg_clearskiesperiod = itemdate;
                                if(debug_periods){console.log("beg_clearskiesperiod = "+ itemdate);}
                            }

                            consecutiveHours++;
                            if (consecutiveHours >= consecutiveHoursThreshold) {
                                //clearSkiesPeriods.push(darkHoursPeriodStartDay);
                                //today clear
                                result_clear_today = true;
                                end_clearskiesperiod = itemdate;
                                if(debug_periods){console.log("end_clearskiesperiod = "+ itemdate);}
                                
                            }
                        } else {
                            consecutiveHours = 0;

                            //TODO PRIO3: check how to remove pushblock redundancy...
                            if(beg_clearskiesperiod != null && end_clearskiesperiod != null)
                            {
                                clearSkiesPeriods.push({start:beg_clearskiesperiod,end:end_clearskiesperiod});
                                beg_clearskiesperiod = null;
                                end_clearskiesperiod = null;
                            }
                        }
                    
                    }
                    else if(itemdate > times_tomorrow.nauticalDusk && itemdate < times_dayaftertomorrow.nauticalDawn) //hourly data is in the dark and below cloud treshold.
                    {
                        if( cloudCoverage <= lowCloudCoverageThreshold)
                        {
                            if(beg_clearskiesperiod == null){
                                beg_clearskiesperiod = itemdate;
                                if(debug_periods){console.log("beg_clearskiesperiod = "+ itemdate);}
                            }

                            consecutiveHoursTomorrow++;
                            if (consecutiveHoursTomorrow >= consecutiveHoursThreshold) {
                                //clearSkiesPeriods.push(darkHoursPeriodStartDay);
                                //today clear
                                result_clear_tomorrow = true;

                                end_clearskiesperiod = itemdate;
                                if(debug_periods){console.log("end_clearskiesperiod = "+ itemdate);}
                            }
                        } else {
                            consecutiveHoursTomorrow = 0;
                             //TODO PRIO3: check how to remove pushblock redundancy...
                             if(beg_clearskiesperiod != null && end_clearskiesperiod != null)
                             {
                                 clearSkiesPeriods.push({start:beg_clearskiesperiod,end:end_clearskiesperiod});
                                 beg_clearskiesperiod = null;
                                 end_clearskiesperiod = null;
                             }
                        }
                        
                    } 
                    else
                    {
                        //TODO PRIO3: check how to remove pushblock redundancy...
                        if(beg_clearskiesperiod != null && end_clearskiesperiod != null)
                        {
                            clearSkiesPeriods.push({start:beg_clearskiesperiod,end:end_clearskiesperiod});
                            beg_clearskiesperiod = null;
                            end_clearskiesperiod = null;
                        }
                    }

                    if (debug) {
                        console.log(`Date: ${itemdate.toISOString()} ${itemdate}, Hour: ${hour} , day: ${day}, cloudcoverage: ${cloudCoverage}, isDarkHours_today : ${(itemdate > times_today.nauticalDusk && itemdate < times_tomorrow.nauticalDawn)}, isDarkHours_tomorrow : ${(itemdate > times_tomorrow.nauticalDusk && itemdate < times_dayaftertomorrow.nauticalDawn)},  hasLowCloudCoverage : ${cloudCoverage <= lowCloudCoverageThreshold}, test: ${times_today.nauticalDusk},${times_tomorrow.nauticalDawn}`);
                    }
                }

                //TODO PRIO3: check how to remove pushblock redundancy...
                if(beg_clearskiesperiod != null && end_clearskiesperiod != null)
                {
                    clearSkiesPeriods.push({start:beg_clearskiesperiod,end:end_clearskiesperiod});
                    beg_clearskiesperiod = null;
                    end_clearskiesperiod = null;
                }

                result = {
                    "clear_skies_periods": clearSkiesPeriods,
                    "clear_today": result_clear_today,
                    "clear_tomorrow": result_clear_tomorrow,
                    "timezone": "UTC"
                };

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
}



//In case of not beeing able to determine darkhours based on lat/lon, use hardcoded 6PM - 6AM.
function initializeDatesTimesEmpty()
{
    const date_today = new Date();
    //date_today.setHours(0,0,0,0);
    
    const  date_tomorrow = new Date();
    date_tomorrow.setDate(date_today.getDate() + 1); //Hacky but might fail on daytime savings etc... so only mostly correct. TODO replace later with more relient method moment, dateJS or js-joda
    //date_tomorrow.setHours(0,0,0,0);
    
    const  date_dayaftertomorrow = new Date();
    date_dayaftertomorrow.setDate(date_tomorrow.getDate() + 1); //Hacky but might fail on daytime savings etc... so only mostly correct. TODO replace later with more relient method moment, dateJS or js-joda
    
    if(debug){
    console.log("Today: " +  date_today);
    console.log("Tomorrow: " +  date_tomorrow);
    }


    times_today = {nauticalDusk: "ERROR", nauticalDawn: "ERROR"}; 
    times_tomorrow = {nauticalDusk: "ERROR", nauticalDawn: "ERROR"}; 
    times_dayaftertomorrow = {nauticalDusk: "ERROR", nauticalDawn: "ERROR"}; 

    times_today.nauticalDusk                    = date_today.setHours(18,0,0,0);
    times_today.nauticalDawn                    = date_today.setHours(6,0,0,0);
    times_tomorrow.nauticalDusk                 = date_tomorrow.setHours(18,0,0,0);
    times_tomorrow.nauticalDawn                 = date_tomorrow.setHours(6,0,0,0);
    times_dayaftertomorrow.nauticalDusk         = date_dayaftertomorrow.setHours(18,0,0,0);
    times_dayaftertomorrow.nauticalDawn         = date_dayaftertomorrow.setHours(6,0,0,0);

    if(debug){
        console.log("Nautical Dusk: " +  times_today.nauticalDusk);
        console.log("Nautical Dawn: " +  times_today.nauticalDawn);
        console.log("Nautical Dusk (tomorrow): " +  times_tomorrow.nauticalDusk);
        console.log("Nautical Dawn (tomorrow): " +  times_tomorrow.nauticalDawn);
    }
    
}

//retrieves darkhours start/end determined by natuical dusk/dawn based on latitude and longitude.
//expects formats of lat/lon in -3.01, -59.91 for example for MANAUS, so not the format from meteosource which would be: 3.01S,59.91W
function initializeDatesTimes(mylat,mylong) 
{
    const date_today = new Date();
    //date_today.setHours(0,0,0,0);
    
    const  date_tomorrow = new Date();
    date_tomorrow.setDate(date_today.getDate() + 1); //Hacky but might fail on daytime savings etc... so only mostly correct. TODO replace later with more relient method moment, dateJS or js-joda
    //date_tomorrow.setHours(0,0,0,0);
    
    const  date_dayaftertomorrow = new Date();
    date_dayaftertomorrow.setDate(date_tomorrow.getDate() + 1); //Hacky but might fail on daytime savings etc... so only mostly correct. TODO replace later with more relient method moment, dateJS or js-joda
    
    if(debug){
    console.log("Today: " +  date_today);
    console.log("Tomorrow: " +  date_tomorrow);
    }
    times_today               = SunCalc.getTimes(date_today, mylat,mylong);
    times_tomorrow            = SunCalc.getTimes(date_tomorrow, mylat,mylong);
    times_dayaftertomorrow    = SunCalc.getTimes(date_dayaftertomorrow, mylat,mylong);
    
    const astronomDarknessDur = times_today.sunset - times_today.sunrise;
    if(debug)
    {
        console.log("AStro darkness: " +  astronomDarknessDur);
        console.log("Surise: " +  times_today.sunrise);
        console.log("Sunset: " +  times_today.sunset);
    }
    console.log("Nautical Dusk: " +  times_today.nauticalDusk + ", Nautical Dawn: " +  times_today.nauticalDawn);
    if(debug)
    {
        console.log("Nautical Dusk (tomorrow): " +  times_tomorrow.nauticalDusk);
        console.log("Nautical Dawn (tomorrow): " +  times_tomorrow.nauticalDawn);
        console.log(times_today);
    }
}


//Converts lat long in format lat = 58.72N lon = 32.14W  into e.g. lat = 58.72, lon -32.14 
//Returns "ERROR" if input doesnt seem to be string for example.
//TODO Error-Handling. 

function convertLatitudeOrLong(meteo_latlong)
{
    if((typeof meteo_latlong === 'string' || meteo_latlong instanceof String))
    {
        var str = new String(meteo_latlong);

        var ret_value = parseFloat(str.substring(0,str.length-1));

        //North = +
        //South = -
        //East = +
        //West = -

        if(str.substring(str.length-1,str.length)=="S"||str.substring(str.length-1,str.length)=="W")
        {
            ret_value = ret_value*-1;
        }
    }
    else
    {
        return "ERROR";
    }

    return ret_value;
}


//deprecated function not used anymore.
/*
async function getLatLonFromPlaceID(placeid)
{
    var obj = {lat: "ERROR", lon: "ERROR", error: true};

    api_url = "https://www.meteosource.com/api/v1/free/find_places?text="+placeid+"&key=" + url_key
    try {
    var response = await fetch(api_url);
    if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
    }
    debug_response = response;
    var data = await response.json();

    var jsonData = data;

    if(debug){
        console.log("DATA:");
        console.log(jsonData);
    }
        //first look if exact match exists.
        for(i=0;i<jsonData.length;i++)
        {
            if(jsonData[i].place_id == placeid)
            {
                if(debug){
                console.log("Found match of "+jsonData[i].place_id);
                console.log(jsonData[i]);
                }
                obj.lat = jsonData[i].lat;
                obj.lon = jsonData[i].lon;
                obj.error = false;
                if(debug){
                    
                    console.log(obj);
                    }
                return obj;
            }
        }

        //fallback
        if(jsonData.length>1)
        {
            if(debug){
            Console.log("FALLBACK")
            console.log(jsonData[0]);
            }
            obj.lat = jsonData[0].lat;
            obj.lon = jsonData[0].lon;
            obj.error = false;

            return obj;
        }
    } catch (e) {
        //console.log("caught error", e); //<-- yet, this is never reached
        console.error("Error fetching data:", e);
        console.log("ERROR");
    }

    return obj;  
}
*/
