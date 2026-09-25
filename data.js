(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  root.SITE_ASSIGNMENT_SEED = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
  "version": 10,
  "sourceDate": "2026-08-31",
  "rules": {
    "overlapMorningTarget": 0.6,
    "overlapMidTarget": 0.4,
    "lockedMorningAssignments": [
      {
        "personId": "morning-carolyn",
        "siteId": "BRK - 6020"
      }
    ],
    "assignmentLocks": [
      {
        "id": "lock-brk-carolyn",
        "personId": "morning-carolyn",
        "siteId": "BRK - 6020"
      }
    ],
    "protectedOverlapSites": [
      "BRK - 6020"
    ],
    "scheduleDefaults": {
      "morning": {
        "start": "06:00",
        "end": "16:00"
      },
      "mid": {
        "start": "12:00",
        "end": "22:00"
      }
    },
    "scheduleTimeline": {
      "start": "00:00",
      "end": "24:00"
    }
  },
  "sites": [
    {
      "id": "BRK - 6020",
      "customer": "WLM",
      "tickets30": 160
    },
    {
      "id": "DOUG-6010",
      "customer": "WLM",
      "tickets30": 136
    },
    {
      "id": "RMNH-6030",
      "customer": "WLM",
      "tickets30": 121
    },
    {
      "id": "STL-6023",
      "customer": "WLM",
      "tickets30": 103
    },
    {
      "id": "PLV-6012",
      "customer": "WLM",
      "tickets30": 101
    },
    {
      "id": "CLM-6006",
      "customer": "WLM",
      "tickets30": 97
    },
    {
      "id": "SYM-6017",
      "customer": "WLM",
      "tickets30": 95
    },
    {
      "id": "MNM-6025",
      "customer": "WLM",
      "tickets30": 93
    },
    {
      "id": "MRC-6038",
      "customer": "WLM",
      "tickets30": 86
    },
    {
      "id": "SRC-6018",
      "customer": "WLM",
      "tickets30": 85
    },
    {
      "id": "MID-6039",
      "customer": "WLM",
      "tickets30": 75
    },
    {
      "id": "GRC-6024",
      "customer": "WLM",
      "tickets30": 68
    },
    {
      "id": "HERM-6037",
      "customer": "WLM",
      "tickets30": 68
    },
    {
      "id": "RBL-6026",
      "customer": "WLM",
      "tickets30": 64
    },
    {
      "id": "WDL-6027",
      "customer": "WLM",
      "tickets30": 59
    },
    {
      "id": "BRH-6011",
      "customer": "WLM",
      "tickets30": 51
    },
    {
      "id": "PAL-6036",
      "customer": "WLM",
      "tickets30": 51
    },
    {
      "id": "NBF-6016",
      "customer": "WLM",
      "tickets30": 50
    },
    {
      "id": "BCK-6031",
      "customer": "WLM",
      "tickets30": 42
    },
    {
      "id": "HMNC-6040",
      "customer": "WLM",
      "tickets30": 40
    },
    {
      "id": "OTW-6035",
      "customer": "WLM",
      "tickets30": 39
    },
    {
      "id": "ALB-IRV",
      "customer": "ALB",
      "tickets30": 36
    },
    {
      "id": "LVL-6019",
      "customer": "WLM",
      "tickets30": 33
    },
    {
      "id": "BETH",
      "customer": "C&C",
      "tickets30": 25
    },
    {
      "id": "PRT-6021",
      "customer": "WLM",
      "tickets30": 23
    },
    {
      "id": "UNFI-JOL",
      "customer": "UNFI",
      "tickets30": 21
    },
    {
      "id": "GT",
      "customer": "GT",
      "tickets30": 17
    },
    {
      "id": "ALB-MP",
      "customer": "ALB",
      "tickets30": 17
    },
    {
      "id": "AFS-FRW",
      "customer": "AFS",
      "tickets30": 13
    },
    {
      "id": "SGL-LVG",
      "customer": "SG",
      "tickets30": 13
    },
    {
      "id": "ALB-TOL",
      "customer": "ALB",
      "tickets30": 10
    },
    {
      "id": "CS-WNL",
      "customer": "C&C",
      "tickets30": 9
    },
    {
      "id": "EXOL-LTH",
      "customer": "C&C",
      "tickets30": 8
    },
    {
      "id": "UNFI-MNC",
      "customer": "UNFI",
      "tickets30": 8
    },
    {
      "id": "TGT-WOOD",
      "customer": "TG",
      "tickets30": 5
    },
    {
      "id": "UNFI-CEN",
      "customer": "UNFI",
      "tickets30": 4
    },
    {
      "id": "EXOL-JCK",
      "customer": "EXOL",
      "tickets30": 0
    },
    {
      "id": "WIL-ITC",
      "customer": "SYM",
      "tickets30": 0
    }
  ],
  "people": [
    {
      "id": "morning-chad",
      "name": "Chad",
      "shift": "morning",
      "role": "tce",
      "vacation": false,
      "fullName": "Chad Cruz Jr.",
      "title": "TCE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "morning-bronson",
      "name": "Bronson",
      "shift": "morning",
      "role": "tse",
      "vacation": false,
      "fullName": "Bronson Wong",
      "title": "TSE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "morning-carolyn",
      "name": "Carolyn",
      "shift": "morning",
      "role": "tse",
      "vacation": false,
      "fullName": "Carolyn Shin",
      "title": "Sr TSE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "morning-david",
      "name": "David",
      "shift": "morning",
      "role": "tce",
      "vacation": false,
      "fullName": "David Lewis",
      "title": "Sr TCE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "morning-youseff",
      "name": "Youssef",
      "shift": "morning",
      "role": "tce",
      "vacation": false,
      "fullName": "Youssef",
      "title": "TCE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day",
      "rosterNote": "Retained from the existing coverage prototype; not present in the latest roster table."
    },
    {
      "id": "morning-josh",
      "name": "Joshua",
      "shift": "morning",
      "role": "tse",
      "vacation": false,
      "fullName": "Joshua Benson",
      "title": "TSE",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "mid-cameron",
      "name": "Cameron",
      "shift": "mid",
      "role": "tse",
      "vacation": false,
      "fullName": "Cameron McCreery",
      "title": "TSE",
      "manager": "Stephen",
      "operationalShiftId": "weekend-mid"
    },
    {
      "id": "mid-garett",
      "name": "Garret",
      "shift": "mid",
      "role": "tce",
      "vacation": false,
      "fullName": "Garret Bishop",
      "title": "TCE",
      "manager": "Stephen",
      "operationalShiftId": "weekend-mid"
    },
    {
      "id": "mid-krysztof",
      "name": "Krysztof",
      "shift": "mid",
      "role": "tse",
      "vacation": false,
      "fullName": "Krysztof Capuras",
      "title": "TSE",
      "manager": "Stephen",
      "operationalShiftId": "weekend-mid"
    }
  ],
  "supportAdmins": [
    {
      "id": "tsa-ryan",
      "name": "Ryan",
      "shift": "morning",
      "role": "tsa",
      "vacation": false,
      "fullName": "Ryan Jackson",
      "title": "TSA",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "tsa-amin",
      "name": "Amin",
      "shift": "morning",
      "role": "tsa",
      "vacation": false,
      "fullName": "Amin Abedelmajid",
      "title": "TSA",
      "manager": "Christopher",
      "operationalShiftId": "weekend-day"
    },
    {
      "id": "tsa-ola",
      "name": "Ola",
      "shift": "mid",
      "role": "tsa",
      "vacation": false,
      "fullName": "Ola",
      "title": "TSA",
      "manager": "Stephen",
      "operationalShiftId": "weekend-mid",
      "rosterNote": "Retained from the existing coverage prototype; not present in the latest roster table."
    }
  ],
  "tsaAssignments": {
    "tsa-ryan": [],
    "tsa-amin": [],
    "tsa-ola": []
  },
  "assignments": {
    "morning-chad": [
      "DOUG-6010",
      "STL-6023",
      "UNFI-CEN",
      "ALB-IRV",
      "SRC-6018",
      "WDL-6027",
      "ALB-MP",
      "MRC-6038"
    ],
    "morning-bronson": [
      "UNFI-JOL",
      "UNFI-MNC",
      "GT",
      "SGL-LVG",
      "CS-WNL",
      "BCK-6031",
      "PAL-6036",
      "PLV-6012",
      "HERM-6037"
    ],
    "morning-carolyn": [
      "BRK - 6020",
      "ALB-TOL",
      "RBL-6026",
      "PRT-6021",
      "EXOL-LTH",
      "CS-WNL",
      "GRC-6024",
      "OTW-6035",
      "BETH"
    ],
    "morning-david": [],
    "morning-youseff": [
      "CLM-6006",
      "AFS-FRW",
      "EXOL-JCK",
      "NBF-6016",
      "SYM-6017",
      "TGT-WOOD",
      "EXOL-LTH"
    ],
    "morning-josh": [
      "BRH-6011",
      "RMNH-6030",
      "LVL-6019",
      "MNM-6025",
      "HMNC-6040",
      "WIL-ITC",
      "MID-6039"
    ],
    "mid-cameron": [
      "BCK-6031",
      "SYM-6017",
      "PAL-6036",
      "OTW-6035",
      "HMNC-6040"
    ],
    "mid-garett": [
      "MRC-6038",
      "MID-6039",
      "ALB-MP",
      "PLV-6012"
    ],
    "mid-krysztof": [
      "TGT-WOOD",
      "GRC-6024",
      "BETH",
      "HERM-6037"
    ]
  },
  "middayPool": [],
  "scheduleOverrides": {},
  "dailyPlans": {},
  "dailyNotes": {},
  "fairnessHistory": {},
  "changeHistory": [],
  "shiftCatalog": [
    {
      "id": "weekday-morning",
      "name": "Weekday Morning",
      "supervisorName": "Matthew Weimer",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "06:00",
      "defaultEnd": "16:00",
      "coverageGroup": null,
      "supervisorId": "roster-matthew-weimer",
      "activeDays": [
        1,
        2,
        3,
        4
      ]
    },
    {
      "id": "weekday-mid",
      "name": "Weekday Mid",
      "supervisorName": "Chaitanya Jagarapu",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "12:00",
      "defaultEnd": "22:00",
      "coverageGroup": null,
      "supervisorId": "roster-chaitanya-jagarapu",
      "activeDays": [
        1,
        2,
        3,
        4
      ]
    },
    {
      "id": "weekday-night",
      "name": "Weekday Night",
      "supervisorName": "Oluwafemi Okediran",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "20:00",
      "defaultEnd": "06:00",
      "coverageGroup": null,
      "supervisorId": "roster-oluwafemi-okediran",
      "activeDays": [
        1,
        2,
        3,
        4
      ]
    },
    {
      "id": "weekend-day",
      "name": "Weekend Day",
      "supervisorName": "Christopher Ramessar",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "06:00",
      "defaultEnd": "16:00",
      "coverageGroup": "morning",
      "supervisorId": "roster-christopher-ramessar",
      "activeDays": [
        5,
        6,
        0,
        1
      ]
    },
    {
      "id": "weekend-mid",
      "name": "Weekend Mid",
      "supervisorName": "Stephen Parker",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "12:00",
      "defaultEnd": "22:00",
      "coverageGroup": "mid",
      "supervisorId": "roster-stephen-parker",
      "activeDays": [
        5,
        6,
        0,
        1
      ]
    },
    {
      "id": "weekend-night",
      "name": "Weekend Night",
      "supervisorName": "Guillermo Rodriguez",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": "20:00",
      "defaultEnd": "06:00",
      "coverageGroup": null,
      "supervisorId": "roster-guillermo-rodriguez",
      "activeDays": [
        5,
        6,
        0,
        1
      ]
    },
    {
      "id": "commissioning",
      "name": "Commissioning",
      "supervisorName": "Michael Westfield",
      "supervisorTitle": "Manager",
      "defaultStart": "08:00",
      "defaultEnd": "17:00",
      "coverageGroup": null,
      "supervisorId": "roster-michael-westfield",
      "activeDays": [
        1,
        2,
        3,
        4,
        5
      ]
    },
    {
      "id": "leader",
      "name": "Leader",
      "supervisorName": "Brian",
      "supervisorTitle": "Leadership",
      "defaultStart": "09:00",
      "defaultEnd": "17:00",
      "coverageGroup": null,
      "supervisorId": null,
      "activeDays": [
        1,
        2,
        3,
        4,
        5
      ]
    },
    {
      "id": "unassigned",
      "name": "Unassigned",
      "supervisorName": "Guillermo Rodriguez",
      "supervisorTitle": "Shift Supervisor",
      "defaultStart": null,
      "defaultEnd": null,
      "coverageGroup": null,
      "supervisorId": "roster-guillermo-rodriguez",
      "activeDays": []
    }
  ],
  "directoryPeople": [
    {
      "id": "roster-anthony-vandiver",
      "name": "Anthony",
      "fullName": "Anthony Vandiver",
      "title": "PM",
      "role": "pm",
      "manager": "Michael",
      "operationalShiftId": "commissioning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-carl-scott",
      "name": "Carl",
      "fullName": "Carl Scott",
      "title": "TCE",
      "role": "tce",
      "manager": "Michael",
      "operationalShiftId": "commissioning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-chauncey-laprarie",
      "name": "Chauncey",
      "fullName": "Chauncey LaPrarie",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Michael",
      "operationalShiftId": "commissioning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-paul-trunfio",
      "name": "Paul",
      "fullName": "Paul Trunfio",
      "title": "TSE",
      "role": "tse",
      "manager": "Michael",
      "operationalShiftId": "commissioning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-michael-westfield",
      "name": "Michael",
      "fullName": "Michael Westfield",
      "title": "Manager",
      "role": "manager",
      "manager": "Brian",
      "operationalShiftId": "leader",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-tony-rodriguez",
      "name": "Tony",
      "fullName": "Tony Rodriguez",
      "title": "Manager",
      "role": "manager",
      "manager": "Brian",
      "operationalShiftId": "leader",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-andrea-capuras",
      "name": "Andrea",
      "fullName": "Andrea Capuras",
      "title": "TSA",
      "role": "tsa",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-chaitanya-jagarapu",
      "name": "Chaitanya",
      "fullName": "Chaitanya Jagarapu",
      "title": "TSS",
      "role": "tss",
      "manager": "Tony",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-darwin-mounsey",
      "name": "Darwin",
      "fullName": "Darwin Mounsey",
      "title": "TSE",
      "role": "tse",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-divyesh-kabariya",
      "name": "Divyesh",
      "fullName": "Divyesh Kabariya",
      "title": "TCE",
      "role": "tce",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-johnathon-duncan",
      "name": "Johnathon",
      "fullName": "Johnathon Duncan",
      "title": "TCE",
      "role": "tce",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-kemar-reid",
      "name": "Kemar",
      "fullName": "Kemar Reid",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-kyle-souza",
      "name": "Kyle",
      "fullName": "Kyle Souza",
      "title": "TSE",
      "role": "tse",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-luis-arteaga",
      "name": "Luis",
      "fullName": "Luis Arteaga",
      "title": "TSA",
      "role": "tsa",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-ryan-mine",
      "name": "Ryan",
      "fullName": "Ryan Mine",
      "title": "Sr TSE",
      "role": "tse",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-sarah-doram",
      "name": "Sarah",
      "fullName": "Sarah Doram",
      "title": "TSA",
      "role": "tsa",
      "manager": "Femi",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-trong-tran",
      "name": "Trong",
      "fullName": "Trong Tran",
      "title": "Sr TSE",
      "role": "tse",
      "manager": "Chaitu",
      "operationalShiftId": "weekday-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-alex-graser",
      "name": "Alex",
      "fullName": "Alex Graser",
      "title": "Sr TSE",
      "role": "tse",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-allen-gonzalez",
      "name": "Allen",
      "fullName": "Allen Gonzalez",
      "title": "TSE",
      "role": "tse",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-anthony-mccain",
      "name": "Anthony",
      "fullName": "Anthony McCain",
      "title": "TSA",
      "role": "tsa",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-cary-lemasters",
      "name": "Cary",
      "fullName": "Cary Lemasters",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-cav-lemasters",
      "name": "Cav",
      "fullName": "Cav Lemasters",
      "title": "Sr TSE",
      "role": "tse",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-kencole-deronville",
      "name": "Kencole",
      "fullName": "Kencole Deronville",
      "title": "TSA",
      "role": "tsa",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-matt-cain",
      "name": "Matt",
      "fullName": "Matt Cain",
      "title": "TCE",
      "role": "tce",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-matthew-weimer",
      "name": "Matthew",
      "fullName": "Matthew Weimer",
      "title": "TSS",
      "role": "tss",
      "manager": "Tony",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-zack-myette",
      "name": "Zack",
      "fullName": "Zack Myette",
      "title": "Sr TSE",
      "role": "tse",
      "manager": "Matt",
      "operationalShiftId": "weekday-morning",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-jaxon-weis",
      "name": "Jaxon",
      "fullName": "Jaxon Weis",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-lawson-medley",
      "name": "Lawson",
      "fullName": "Lawson Medley",
      "title": "TCE",
      "role": "tce",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-matt-fernandez",
      "name": "Matt",
      "fullName": "Matt Fernandez",
      "title": "TSE",
      "role": "tse",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-matthew-ages",
      "name": "Matthew",
      "fullName": "Matthew Ages",
      "title": "TSE",
      "role": "tse",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-oluwafemi-okediran",
      "name": "Oluwafemi",
      "fullName": "Oluwafemi Okediran",
      "title": "TSS",
      "role": "tss",
      "manager": "Tony",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-patrick-gamache",
      "name": "Patrick",
      "fullName": "Patrick Gamache",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-roshon-williams",
      "name": "Roshon",
      "fullName": "Roshon Williams",
      "title": "TSE",
      "role": "tse",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-tyler-mackey",
      "name": "Tyler",
      "fullName": "Tyler Mackey",
      "title": "TSE",
      "role": "tse",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-zachary-buser",
      "name": "Zachary",
      "fullName": "Zachary Buser",
      "title": "TSE",
      "role": "tse",
      "manager": "Femi",
      "operationalShiftId": "weekday-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-christopher-ramessar",
      "name": "Christopher",
      "fullName": "Christopher Ramessar",
      "title": "Shift Supervisor",
      "role": "supervisor",
      "manager": "Tony",
      "operationalShiftId": "weekend-day",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-stephen-parker",
      "name": "Stephen",
      "fullName": "Stephen Parker",
      "title": "TSS",
      "role": "tss",
      "manager": "Tony",
      "operationalShiftId": "weekend-mid",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-clark-workman",
      "name": "Clark",
      "fullName": "Clark Workman",
      "title": "Sr TCE",
      "role": "tce",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-guillermo-rodriguez",
      "name": "Guillermo",
      "fullName": "Guillermo Rodriguez",
      "title": "TSS",
      "role": "tss",
      "manager": "Tony",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-jonathan-sandoval",
      "name": "Jonathan",
      "fullName": "Jonathan Sandoval",
      "title": "TSA",
      "role": "tsa",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-kevin-mitchell",
      "name": "Kevin",
      "fullName": "Kevin Mitchell",
      "title": "TSE",
      "role": "tse",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-khalid-javed",
      "name": "Khalid",
      "fullName": "Khalid Javed",
      "title": "TSE",
      "role": "tse",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-michael-herrera",
      "name": "Michael",
      "fullName": "Michael Herrera",
      "title": "TSE BP",
      "role": "tse",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    },
    {
      "id": "roster-ricardo-perez",
      "name": "Ricardo",
      "fullName": "Ricardo Perez",
      "title": "TSE",
      "role": "tse",
      "manager": "Guillermo",
      "operationalShiftId": "weekend-night",
      "vacation": false,
      "directoryOnly": true
    }
  ],
  "rosterMeta": {
    "source": "Roster supplied 2026-08-31",
    "latestRosterCount": 53,
    "retainedPrototypePeople": [
      "Youssef",
      "Ola",
      "Christopher Ramessar"
    ]
  },
  "recurringSchedules": {"morning-david":{"personId":"morning-david","fullName":"David Lewis","shiftId":"weekend-day","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"06:00","end":"18:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"06:00","end":"18:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"06:00","end":"18:00","note":null}]},"morning-chad":{"personId":"morning-chad","fullName":"Chad Cruz Jr.","shiftId":"weekend-day","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"06:00","end":"18:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"06:00","end":"18:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"06:00","end":"18:00","note":null}]},"morning-josh":{"personId":"morning-josh","fullName":"Joshua Benson","shiftId":"weekend-day","replacesShiftDefault":true,"source":"User-confirmed 2026-09-25","note":"40-hour Weekend Day pattern; 8 AM-6 PM","segments":[{"isoWeekday":1,"segmentOrder":0,"start":"08:00","end":"18:00","note":null},{"isoWeekday":5,"segmentOrder":0,"start":"08:00","end":"18:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"08:00","end":"18:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"08:00","end":"18:00","note":null}]},"mid-krysztof":{"personId":"mid-krysztof","fullName":"Krysztof Capuras","shiftId":"weekend-mid","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"08:00","end":"20:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"08:00","end":"20:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"08:00","end":"20:00","note":null}]},"mid-garett":{"personId":"mid-garett","fullName":"Garret Bishop","shiftId":"weekend-mid","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"Monday 12-10; Fri-Sun 10-8","segments":[{"isoWeekday":1,"segmentOrder":0,"start":"12:00","end":"22:00","note":null},{"isoWeekday":5,"segmentOrder":0,"start":"10:00","end":"20:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"10:00","end":"20:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"10:00","end":"20:00","note":null}]},"roster-chaitanya-jagarapu":{"personId":"roster-chaitanya-jagarapu","fullName":"Chaitanya Jagarapu","shiftId":"weekday-mid","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"Alternating weekday start times","segments":[{"isoWeekday":1,"segmentOrder":0,"start":"12:00","end":"22:00","note":null},{"isoWeekday":2,"segmentOrder":0,"start":"10:00","end":"20:00","note":null},{"isoWeekday":3,"segmentOrder":0,"start":"12:00","end":"22:00","note":null},{"isoWeekday":4,"segmentOrder":0,"start":"10:00","end":"20:00","note":null}]},"roster-darwin-mounsey":{"personId":"roster-darwin-mounsey","fullName":"Darwin Mounsey","shiftId":"weekday-mid","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"1 PM-9 PM Monday-Friday","segments":[{"isoWeekday":1,"segmentOrder":0,"start":"13:00","end":"21:00","note":null},{"isoWeekday":2,"segmentOrder":0,"start":"13:00","end":"21:00","note":null},{"isoWeekday":3,"segmentOrder":0,"start":"13:00","end":"21:00","note":null},{"isoWeekday":4,"segmentOrder":0,"start":"13:00","end":"21:00","note":null},{"isoWeekday":5,"segmentOrder":0,"start":"13:00","end":"21:00","note":null}]},"roster-michael-herrera":{"personId":"roster-michael-herrera","fullName":"Michael Herrera","shiftId":"weekend-night","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"18:00","end":"06:00","note":null}]},"roster-khalid-javed":{"personId":"roster-khalid-javed","fullName":"Khalid Javed","shiftId":"weekend-night","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"18:00","end":"06:00","note":null}]},"roster-kevin-mitchell":{"personId":"roster-kevin-mitchell","fullName":"Kevin Mitchell","shiftId":"weekend-night","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"36-hour Fri-Sun pattern","segments":[{"isoWeekday":5,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":6,"segmentOrder":0,"start":"18:00","end":"06:00","note":null},{"isoWeekday":7,"segmentOrder":0,"start":"18:00","end":"06:00","note":null}]},"roster-matthew-weimer":{"personId":"roster-matthew-weimer","fullName":"Matthew Weimer","shiftId":"weekday-morning","replacesShiftDefault":true,"source":"Microsoft Shifts screenshot 2026-09-25","note":"Split Tuesday/Thursday coverage as displayed in Microsoft Shifts","segments":[{"isoWeekday":1,"segmentOrder":0,"start":"06:00","end":"16:00","note":null},{"isoWeekday":2,"segmentOrder":0,"start":"05:00","end":"08:30","note":null},{"isoWeekday":2,"segmentOrder":1,"start":"13:00","end":"17:30","note":null},{"isoWeekday":3,"segmentOrder":0,"start":"06:00","end":"16:00","note":null},{"isoWeekday":4,"segmentOrder":0,"start":"05:00","end":"08:30","note":null},{"isoWeekday":4,"segmentOrder":1,"start":"13:00","end":"17:30","note":null}]}},
  "coveragePlans": {}
};
});
