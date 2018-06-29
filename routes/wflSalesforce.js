const express = require("express")
const router = express.Router()

console.log("hi mike")
var request = require("request")
var csvjson = require("csvjson")
var helmet = require("helmet")
var sendmail = require("sendmail")()
var schedule = require("node-schedule")
var SalesforceConnection = require("node-salesforce-connection")
require("dotenv").config()

var app = express()
app.use(helmet())

let sfusername = process.env.USERNAME
let sfpassword = process.env.PASSWORD

var j = schedule.scheduleJob("06 18 * * *", function() {
  get_token(process.env.WFLPULLREPORT)
})
var j = schedule.scheduleJob("05 5 16 * *", function() {
  get_token(process.env.WFLPULLREPORT)
})

var j = schedule.scheduleJob("15 18 * * *", function() {
  get_token(process.env.WFLPULLOTHER)
})
var j = schedule.scheduleJob("20 5 16 * *", function() {
  get_token(process.env.WFLPULLOTHER)
})

var wflusername = process.env.WFLUSERNAME
var wflpassword = process.env.WFLPASSWORD
var wflcompany = process.env.WFLCOMPANY
var wflapiKey = process.env.WFLAPIKEY

var data = JSON.stringify({
  credentials: {
    username: wflusername,
    password: wflpassword,
    company: wflcompany
  }
})

var headers = {
  "Content-type": "application/json",
  "Api-Key": wflapiKey
}

get_token = url => {
  // Configure the request
  var options = {
    url: process.env.WFLLOGIN,
    method: "POST",
    headers: headers,
    body: data
  }

  console.log("getting token")
  // Start the request
  request(options, function(error, response) {
    if (!error && response.statusCode == 200) {
      let json = JSON.parse(response.body)
      token = json.token
      pullReport(token, url)
    } else {
      console.log("error", error)
    }
  })
}

pullReportList = token => {
  var options = {
    method: "GET",
    url: process.env.WFLREPORTLIST,
    headers: {
      "content-type": "text/json",
      authentication: "bearer " + token
    }
  }

  request(options, function(error, response, body) {
    if (error) throw new Error(error)
  })
}

pullReport = (token, url) => {
  var options = {
    method: "GET",
    url: url,
    headers: {
      "content-type": "text/csv",
      authentication: "bearer " + token
    }
  }

  request(options, function(error, response, body) {
    if (error) throw new Error(error)

    let json = csvjson.toArray(body)
    var i = 1
    console.log(json)
    if (url === process.env.WFLPULLREPORT) {
      salesforce(json, i)
    } else if (url === process.env.WFLPULLOTHER) {
      console.log("we are here")
      salesforceOther(json, i)
    }
  })
}

salesforce = (json, i) => {
  ;(async () => {
    let sfConn = new SalesforceConnection()

    await sfConn.soapLogin({
      hostname: "login.salesforce.com",
      apiVersion: "39.0",
      username: sfusername,
      password: sfpassword
    })

    for (i = i; i < json.length; i++) {
      console.log(i)
      let company = json[i][0]
      let employees = json[i][1]
      let street = json[i][2]
      let city = json[i][3]
      let state = json[i][4]
      let zip = json[i][5]
      let tlm = json[i][7]
      let hris = json[i][8]

      var body = {
        BillingStreet: street,
        BillingCity: city,
        BillingState: state,
        BillingPostalCode: zip,
        NumberOfEmployees: employees,
        HRIS_System__c: hris,
        Time_Clock_System__c: tlm
      }

      await sfConn.rest(
        "/services/data/v39.0/sobjects/Account/Company_ID__c/" + company,
        { method: "PATCH", body: body }
      )

      let recentAccounts = await sfConn.rest(
        "/services/data/v39.0/sobjects/Account/Company_ID__c/" + company
      )

      //console.log(recentAccounts)
      global.json = json
      global.i = i
    }
    //console.log("end of the loop")
  })().catch(ex => {
    //console.error(JSON.stringify(ex.stack))

    salesforce(global.json, global.i + 2)
    //console.log(JSON.stringify(global.json[global.i + 1]))
    sendEmail(JSON.stringify(global.json[global.i + 1]))
  })
}

function salesforceOther(json, i) {
  ;(async () => {
    let sfConn = new SalesforceConnection()

    await sfConn.soapLogin({
      hostname: "login.salesforce.com",
      apiVersion: "39.0",
      username: sfusername,
      password: sfpassword
    })

    for (i = 0; i < json.length; i++) {
      let company = json[i][0]
      let wc = json[i][1]
      let hr = json[i][2]

      var body = {
        HR_Support__c: hr
      }

      if (wc && hr) {
        console.log(1)
        console.log("company name", company)
        console.log("workers comp", wc)
        console.log("hr support", hr)
      } else if (wc) {
        console.log(2)
        console.log("company name", company)
        console.log("workers comp", wc)
      } else if (hr) {
        console.log(3)
        console.log("company name", company)
        console.log("hr support", hr)
        var body = {
          HR_Support__c: hr
        }
        await sfConn.rest(
          "/services/data/v39.0/sobjects/Account/Company_ID__c/" + company,
          { method: "PATCH", body: body }
        )

        let recentAccounts = await sfConn.rest(
          "/services/data/v39.0/sobjects/Account/Company_ID__c/" + company
        )
        console.log(recentAccounts)
      }

      global.json = json
      global.i = i
    }
    //console.log("end of the loop")
  })().catch(ex => {
    //console.error(JSON.stringify(ex.stack))
    salesforceOther(global.json, global.i + 2)
    //console.log(JSON.stringify(global.json[global.i + 1]))
    sendEmail(JSON.stringify(global.json[global.i + 1]))
  })
}

function sendEmail(text) {
  sendmail(
    {
      from: "wfl-sfdc@integration.com",
      to: process.env.EMAIL,
      subject: "Integration error",
      html: text
    },
    function(err, reply) {
      //console.log(err && err.stack)
      //console.dir(reply) hello
    }
  )
}

module.exports = router
