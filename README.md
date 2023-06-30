# astro_alert (JavaScript webservice / script)

!!! Use this code at your own risk !!!
I am not a professional web developer, but improvements/suggestions are welcome anytime.

## Introduction

The script will call a weather API (www.meteosource.com) and will respond with "clear_today" true/false or "clear_tomorrow" true/false, depending on the data received from the weather API.
The intention is that this script can be used as a 
This is a simple script on Node.js server implementation using various libraries and modules such as (node-fetch github.com/node-fetch/node-fetch,http,url).
 
## URL Parameters
| Name      | Description         | 
| ------------- |:-------------|
| key 		| your meteosource.com API key, format example: "2rw98kbh2ou0z1efb61yrutly0g0z9gw2rw98kbh" please note this is a random string and not a working key.
| place_id 	| a place id for your place/city... from meteosource.com see API /find_places --> https://www.meteosource.com/documentation#find_places, example value: "berlin-5083330" or "berlin", for big cities usually the cityname such as "berlin", "hamburg" works. in the example value "berlin-5083330" the value refers to the city berlin in Newhampshire USA.
|lat 		| latitude in the format "23.31667S"
|lon 		| GPS longitude in the format "17.83333E"

## Response
Please find an example response below:

"clear_skies_periods" is basically a left over from debugging, but still is useful for me. However the "clear_today" and "clear_tomorrow" is the main information.

```JSON
{
    "clear_skies_periods": [
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23
    ],
    "clear_today": true,
    "clear_tomorrow": false
}
```
## Prerequisites
1) You need to know either your place_id or your lat+long
2) You need to bring your own meteosource API key, as I use the free tier my key is limited to 400 calls per day and 10 per minute, we would quite fast exceed the limits. However no problem, as the registration is fast and easy, so you can have your own in a couple of minutes: https://www.meteosource.com/client/sign-up

## Notes
1) The code is not clean, nor optimized but it is working for my purpose. Feel free to suggest improvements. However its not intended to work in e.g. a commercial environment. So us it at your own risk.

### Possible improvements
1) make thresholds like how much hours of consecutive clear skies will trigger clear_today to become true, or the cloud treshold currently the value is fix to XX.
2) Describe a way to host the script directly in HA to avoid additional cloud component. (to lazy at the moment to dive deeper here, but if you want to support, get in contact with me).

## Intended Use Case

I was searching for a solution to bring a notification to my smartphone, if the next night has clear skies for hobby astronomy. Instead of manually checking the Clear Outside App (which is a great app). Clear outside uses the meteosource Weather API, so I created a webservice that is able to use similar data as the app Clear Outside. I wasn't succsessful in writing a script that can run inside of HA(Home Assistant) so I created this webservice that can be run in your infrastructure of choice locally or in the cloud (how I use it see below). What I did is, I tied a HA sensor to the result of my astro_alert webservice, which responds with true/false if in the evening the sky is clear.

### Host web service
I am using https://www.cyclic.sh/ and host there my webservice, as they have a free tier that works well for me. (Tied directly with my github repository, to automate deployment in case of changes).


### Home Assistant
At the time of writing this documentation I am using Home Assistant 2023.5.4, Supervisor 2023.06.2, Operating System 10.2.
To be able to get notification, you first need to setup a senor that contains the binary value that the astro_alert service responds.

#### Sky Clear Tonight (Binary Sensor)
I use the follwing code snippet inside my configuration.yaml, this results in a sensor named "sky clear tonight". that can be used in an automation to send notifications via the Home Assistant App. 
Note you dont need to use place_id, you can refer to the location also via Lat/Long.

**Make sure to replace the URL in "resource: https://..." with you own!**

configuration.yaml
```YAML
...

binary_sensor: 
- platform: rest
  resource: https://<<REPLACE WITH YOU SERVICE URL>>.cyclic.app/?place_id=<<REPLACE WITH YOU PLACE ID>>&key=<<REPLACE WITH YOUR KEY>>
  method: GET
  name: "sky clear tonight"
  scan_interval: 3600 # 1 hours
  value_template: >
    {% if value_json is defined %}
      {{value_json.clear_today}}
    {% else %}
      unknown
    {% endif %}
...

```
#### Sky Clear Tonight (Notification)
I use the following automation to send a notification message with the text "Clear Skies Tonight!" to my mobilephone via the HA Android App.
The script is set up to send the notification only if the value is stable for multiple subsequent calls to the API.
(Forecast changes and I don't want to get to much notifications, so I want only to know if its seems stable that the sky is clear and nur because at 11 AM for 30 Minutes the forecast showed its clear...)
Further improvements possible -> hide the notification in case a later forecast says its not any longer clear tonight.

Here is what the notification looks like:
<img src="https://github.com/codeleger/astro_alert/blob/8326f57d0e0b4ce564ddc23fbadaa54bc39230a1/doc/ha_notification.jpg" height=250>

```YAML
alias: Clear Today Notification
description: ""
trigger:
  - platform: state
    entity_id:
      - binary_sensor.sky_clear_tonight
    from: "off"
    to: "on"
    for:
      hours: 3
      minutes: 00
      seconds: 0
condition: []
action:
  - service: notify.mobile_app_XXXXXXX
    data:
      message: Clear Skies Tonight!
      data:
        tag: astro-today
mode: single
```

## License
Feel free to reuse, modify and you name it, but make sure to credit the creator.
the license is CC Attribution 4.0 International

