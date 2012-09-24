/*
 * Copyright 2011-2012 Research In Motion Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Whitelist = require("../../lib/policy/whitelist").Whitelist,
    _whitelist = new Whitelist(),
    _event = require("../../lib/event"),
    _utils = require("../../lib/utils"),
    _applicationEvents = require("../../lib/events/applicationEvents"),
    _ppsEvents = require("../../lib/pps/ppsEvents"),
    // This object is used by action map and contains links between pps object fields monitored for change in that object helper methods
    // to analyze if the value is the one callback should be invoked and fields name and value format as would appear on return.
    // Set disableOnChange to true if not interested on change for a particular field but still interested to return its value.
    _eventsMap = {
        batterycritical: {
            eventName: "batterycritical",
            eventDetailsArr: [{
                path: "/pps/services/power/battery?wait,delta",
                fieldNameArr: [{
                    eventName: "StateOfCharge",
                    paramName: "level",
                    fieldValue: null,
                    reset: function () {
                        this.setFieldValue(null);
                    },
                    setFieldValue: function (value) {
                        this.fieldValue = value ? this.formatValue(value) : value;
                    },
                    formatValue: function (str) {
                        return parseInt(str, 10);
                    },
                    skipTrigger: function (value) {
                        var threshold = 4,
                            formattedValue = this.formatValue(value),
                            result = (formattedValue > threshold) || (this.fieldValue && this.fieldValue <= threshold);

                        this.fieldValue = formattedValue;

                        return result;
                    }
                }]
            }, {
                path: "/pps/services/power/charger?wait,delta",
                disableOnChange: true,
                fieldNameArr: [{
                    eventName: "ChargingState",
                    paramName: "isPlugged",
                    formatValue: function (str) {
                        return (str === "NC" ? false : true);
                    }
                }]
            }],
            mode: 0
        },
        batterylow: {
            eventName: "batterylow",
            eventDetailsArr: [{
                path: "/pps/services/power/battery?wait,delta",
                fieldNameArr: [{
                    eventName: "StateOfCharge",
                    paramName: "level",
                    fieldValue: null,
                    reset: function () {
                        this.setFieldValue(null);
                    },
                    setFieldValue: function (value) {
                        this.fieldValue = value ? this.formatValue(value) : value;
                    },
                    formatValue: function (str) {
                        return parseInt(str, 10);
                    },
                    skipTrigger: function (value) {
                        var threshold = 14,
                            formattedValue = this.formatValue(value),
                            result = (formattedValue > threshold) || (this.fieldValue && this.fieldValue <= threshold);

                        this.fieldValue = value;

                        return result;
                    }
                }]
            }, {
                path: "/pps/services/power/charger?wait,delta",
                disableOnChange: true,
                fieldNameArr: [{
                    eventName: "ChargingState",
                    paramName: "isPlugged",
                    formatValue: function (str) {
                        return (str === "NC" ? false : true);
                    }
                }]
            }],
            mode: 0
        },
        batterystatus: {
            eventName: "batterystatus",
            eventDetailsArr: [{
                path: "/pps/services/power/battery?wait,delta",
                fieldNameArr: [{
                    eventName: "StateOfCharge",
                    paramName: "level",
                    formatValue: function (str) {
                        return parseInt(str, 10);
                    }
                }]
            }, {
                path: "/pps/services/power/charger?wait,delta",
                fieldNameArr: [{
                    eventName: "ChargingState",
                    paramName: "isPlugged",
                    formatValue: function (str) {
                        return (str === "NC" ? false : true);
                    }
                }]
            }],
            mode: 0
        }
    },
    _actionMap = {
        batterycritical: {
            context: _ppsEvents,
            event: _eventsMap.batterycritical,
            trigger: function (args) {
                _event.trigger("batterycritical", args);
            }
        },
        batterylow: {
            context: _ppsEvents,
            event: _eventsMap.batterylow,
            trigger: function (args) {
                _event.trigger("batterylow", args);
            }
        },
        batterystatus: {
            context: _ppsEvents,
            event: _eventsMap.batterystatus,
            trigger: function (args) {
                _event.trigger("batterystatus", args);
            }
        },
        languagechanged: {
            context: _applicationEvents,
            event: "systemLanguageChange",
            trigger: function (language) {
                _event.trigger("languagechanged", language);
            }
        },
        regionchanged: {
            context: _applicationEvents,
            event: "systemRegionChange",
            trigger: function (region) {
                _event.trigger("regionchanged", region);
            }
        },
        fontchanged: {
            context: _applicationEvents,
            event: "fontchanged",
            trigger: function (fontFamily, fontSize) {
                _event.trigger("fontchanged", {'fontFamily': fontFamily, 'fontSize': fontSize});
            }
        }
    },
    ERROR_ID = -1;


function getCurrentTimezone(success, fail) {
    var pps = qnx.webplatform.pps,
        ppsObj = pps.create("/pps/services/confstr/_CS_TIMEZONE", pps.PPSMode.FULL);

    ppsObj.open(pps.FileMode.RDONLY);
    if (ppsObj.data && ppsObj.data._CS_TIMEZONE) {
        success(ppsObj.data._CS_TIMEZONE._CS_TIMEZONE);
    } else {
        success(null);
    }
}

function getTimezones(success, fail) {
    var errorHandler = function (e) {
            fail(-1, "Fail to read timezones");
        },
        gotFile = function (fileEntry) {
            fileEntry.file(function (file) {
                var reader = new FileReader();

                reader.onloadend = function (e) {
                    var fileContent = this.result,
                        lines = fileContent.split("\n"),
                        timezones = [];

                    lines.forEach(function (line) {
                        if (/^"/.test(line)) {
                            timezones.push(line.replace(/"/g, ""));
                        }
                    });
                    success(timezones);
                };

                reader.readAsText(file);
            }, errorHandler);
        },
        onInitFs = function (fs) {
            fs.root.getFile("/usr/share/zoneinfo/tzvalid", {create: false}, gotFile, errorHandler);
        };

    window.qnx.webplatform.getController().setFileSystemSandbox = false;
    window.webkitRequestFileSystem(window.PERSISTENT, 1024 * 1024, onInitFs, errorHandler);
}

module.exports = {
    registerEvents: function (success, fail) {
        try {
            var _eventExt = _utils.loadExtensionModule("event", "index");
            _eventExt.registerEvents(_actionMap);
            success();
        } catch (e) {
            fail(-1, e);
        }
    },

    hasPermission: function (success, fail, args, env) {
        // TODO string argument surrounded by %22
        // preserve dot for feature id
        var module = args.module.replace(/[^a-zA-Z.]+/g, ""),
            allowed = _whitelist.isFeatureAllowed(env.request.origin, module);

        // ALLOW - 0, DENY - 1
        success(allowed ? 0 : 1);
    },

    hasCapability: function (success, fail, args) {
        var SUPPORTED_CAPABILITIES = [
                "input.touch",
                "location.gps",
                "media.audio.capture",
                "media.video.capture",
                "media.recording",
                "network.bluetooth",
                "network.wlan"
            ],
            // TODO string argument surrounded by %22
            // preserve dot for capabiliity
            capability = args.capability.replace(/[^a-zA-Z.]+/g, "");

        success(SUPPORTED_CAPABILITIES.indexOf(capability) >= 0);
    },

    getFontInfo: function (success, fail) {
        var fontFamily,
            fontSize;

        try {
            fontFamily = window.qnx.webplatform.getApplication().getSystemFontFamily();
            fontSize = window.qnx.webplatform.getApplication().getSystemFontSize();

            success({'fontFamily': fontFamily, 'fontSize': fontSize});
        } catch (e) {
            fail(ERROR_ID, e);
        }
    },

    getDeviceProperties: function (success, fail) {
        try {
            var returnObj = {
                "hardwareId" : window.qnx.webplatform.device.hardwareId,
                "softwareVersion" : window.qnx.webplatform.device.scmBundle,
                "name" : window.qnx.webplatform.device.deviceName
            };
            success(returnObj);
        } catch (err) {
            fail(ERROR_ID, err.message);
        }
    },

    region: function (success, fail) {
        var region;

        try {
            region = window.qnx.webplatform.getApplication().systemRegion;
            success(region);
        } catch (e) {
            fail(ERROR_ID, e.message);
        }
    },

    getCurrentTimezone: function (success, fail, args, env) {
        getCurrentTimezone(success, fail);
    },

    getTimezones: function (success, fail, args, env) {
        getTimezones(success, fail);
    }
};
