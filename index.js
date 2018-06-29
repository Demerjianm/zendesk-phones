const express = require("express")
const app = express()
const port = 3000
const axios = require("axios")
const moment = require("moment")
const phoneFormatter = require("phone-formatter")
const helmet = require("helmet")
let SalesforceConnection = require("node-salesforce-connection")
const schedule = require("node-schedule")
require("dotenv").config()
moment().format()

let username = process.env.USERNAME
let password = process.env.PASSWORD

app.use(helmet())

//this is the scheduler so app runs at 1230am PST everyday
var j = schedule.scheduleJob("30 7 * * *", function() {
  getUsers()
})

var j = schedule.scheduleJob("35 7 * * *", function() {
  userInfo()
})

var j = schedule.scheduleJob("40 7 * * *", function() {
  organizationInfo()
})

//get the user from zendesk
function getUsers() {
  //gets data and subtract one day
  var date = moment()
    .subtract(2, "day")
    .format("YYYY-MM-DD")

  console.log(date)

  axios
    .get(process.env.USERSURL + date, {
      headers: {
        Authorization: "Basic " + process.env.AUTH
      }
    })
    .then(response => {
      wooks(response.data.results)
    })
    .catch(error => {
      console.log(error)
    })
}

organizationInfo = () => {
  var date = moment()
    .subtract(2, "day")
    .format("YYYY-MM-DD")

  axios
    .get(process.env.ORGURL + date, {
      headers: {
        Authorization: "Basic " + process.env.AUTH
      }
    })
    .then(response => {
      let companies = response.data
      console.log("this is the organizations results")
      console.log("____________________________________")
      console.log(companies)
      var j = 0
      sfAccount(companies, j)
    })
}

userInfo = () => {
  var date = moment()
    .subtract(2, "day")
    .format("YYYY-MM-DD")

  axios
    .get(process.env.USERSURL + date, {
      headers: {
        Authorization: "Basic " + process.env.AUTH
      }
    })
    .then(response => {
      let users = response.data
      console.log("this is the USER results")
      console.log("____________________________________")
      var j = 0
      sfContact(users, j)
    })
}

async function sfAccount(companies, j) {
  let sfConn = new SalesforceConnection()

  await sfConn.soapLogin({
    hostname: "login.salesforce.com",
    apiVersion: "39.0",
    username: username,
    password: password
  })

  for (j = j; j < companies.results.length; j++) {
    console.log(companies.results.length)
    var company = companies.results[j]
    if (company.organization_fields.company_id != "-") {
      console.log(j)
      console.log("ID: ", company.id)
      console.log("Name: ", company.name)
      console.log("401K : ", company.organization_fields["401k_file"])
      console.log("Account Type: ", company.organization_fields.account_type)
      console.log("Active client: ", company.organization_fields.active_client)
      console.log(
        "External File Uploads: ",
        company.organization_fields.external_file_uploads_by_payroll_link
      )
      console.log("HR Support: ", company.organization_fields.hr_support)
      console.log("OVM: ", company.organization_fields.ovm)
      console.log(
        "Payroll System: ",
        company.organization_fields.payroll_system
      )
      console.log(
        "Time clock system: ",
        company.organization_fields.time_clock_system
      )
      console.log(
        "WC Pay as you Go: ",
        company.organization_fields.wc_pay_as_you_go
      )
      console.log("COMPANY ID: ", company.organization_fields.company_id)
      console.log("CSR: ", company.organization_fields.csr_)
      console.log(
        "Service Level: ",
        company.organization_fields.co_service_level
      )
      console.log("____________________________________")

      var body = {
        Name: company.name,
        Account_Type__c: company.organization_fields.account_type,
        Active__c: company.organization_fields.active_client,
        Company_ID__c: company.organization_fields.company_id,
        In_Transition__c: company.organization_fields.internal_platform_switch,
        CSR__c: company.organization_fields.csr_,
        Related_Companies__c: company.organization_fields.related_companies,
        Service_Level__c: company.organization_fields.co_service_level,
        Payroll_System__c: company.organization_fields.payroll_system,
        Time_Clock_System__c: company.organization_fields.time_clock_system,
        OVM__c: company.organization_fields.ovm
      }
      console.log(body)

      await sfConn
        .rest(
          "/services/data/v39.0/sobjects/Account/Zendesk_ID__c/" + company.id,
          { method: "PATCH", body: body }
        )
        .catch(err => console.log(err))

      let recentAccount = await sfConn.rest(
        "/services/data/v39.0/sobjects/Account/Zendesk_ID__c/" + company.id
      )
      console.log(recentAccount)
    }
  }
}

async function sfContact(users, j) {
  console.log(j)

  for (j = j; j < users.results.length; j++) {
    console.log("sf contact", j)
    if (
      users.results[j].organization_id !== 251863118 &&
      users.results[j].organization_id &&
      !users.results[j].user_fields.dont_export_to_salesforce
    ) {
      var user = users.results[j]

      let sfConn = new SalesforceConnection()

      await sfConn.soapLogin({
        hostname: "login.salesforce.com",
        apiVersion: "39.0",
        username: username,
        password: password
      })

      console.log(user)
      let recentAccounts = await sfConn.rest(
        "/services/data/v39.0/sobjects/Account/Zendesk_ID__c/" +
          user.organization_id
      )

      let name = user.name
      let result = name.split(" ")
      let firstName = result[0]
      let lastName = result[1]

      var body = {
        FirstName: firstName,
        LastName: lastName,
        Email: user.email,
        Phone: user.phone,
        Direct_Line__c: user.user_fields.direct_line,
        Fax: user.user_fields.fax,
        MobilePhone: user.user_fields.cell,
        Newsletter_Opt_Out__c: user.user_fields.newsletter_opt_out,
        OtherPhone: user.user_fields.other_phone,
        BS_Preferred_Communication__c:
          user.user_fields.preffered_method_of_contact,
        Primary_Contact__c: user.user_fields.primary_contact,
        Reference_Approved__c: user.user_fields.reference_approved,
        Terminated__c: user.user_fields.terminated_contact,
        Title: user.user_fields.title,
        Authorized__c: user.user_fields.authorized,
        BS_Active__c: user.user_fields.active_client_contact,
        AccountId: recentAccounts.Id,
        Exec_DM__c: user.user_fields.exec_dm,
        BS_Preferred_Communication__c:
          user.user_fields.preffered_method_of_contact
      }

      console.log("ID: ", user.id)
      console.log("First Name: ", firstName)
      console.log("Last Name: ", lastName)
      console.log("Phone: ", user.phone)
      console.log("Authorized: ", user.user_fields.authorized)
      console.log("Act.Contact: ", user.user_fields.active_client_contact)
      console.log("Direct Line: ", user.user_fields.direct_line)
      console.log("EMAIL: ", user.email)
      console.log("EXEC DM: ", user.user_fields.exec_dm)
      console.log("Fax: ", user.user_fields.fax)
      console.log("Cell: ", user.user_fields.cell)
      console.log("Newsletter: ", user.user_fields.newsletter_opt_out)
      console.log("Other Phone: ", user.user_fields.other_phone)
      console.log(
        "Preffered method contact: ",
        user.user_fields.preffered_method_of_contact
      )
      console.log("Primary Contact: ", user.user_fields.primary_contact)
      console.log("Reference Approved: ", user.user_fields.reference_approved)
      console.log("Terminated Contact: ", user.user_fields.terminated_contact)
      console.log("Title: ", user.user_fields.title)
      console.log("Organization Id: ", user.organization_id)

      console.log("____________________________________")
      console.log(body)
      await sfConn
        .rest(
          "/services/data/v39.0/sobjects/Contact/External_Id__c/" + user.id,
          { method: "PATCH", body: body }
        )
        .catch(err => console.log(err))
      console.log("it maid it to the end of normal contact")
    }
  }
}

async function wooks(data) {
  var masterArr = []
  for (var i = 0; i < data.length; i++) {
    var id = data[i].id
    var name = data[i].name
    var email = data[i].email
    var otherPhone = data[i].user_fields.other_phone
    var cell = data[i].user_fields.cell
    var directLine = data[i].user_fields.direct_line
    var arrOther = [id, otherPhone]
    var arrCell = [id, cell]
    var arrDirect = [id, directLine]
    //create array for each phone
    masterArr.push(arrOther)
    masterArr.push(arrCell)
    masterArr.push(arrDirect)
  }
  beenie(masterArr)
}

async function beenie(masterArr) {
  var finalArray = []
  //filter array for only valid numbers and format them
  for (var i = 0; i < masterArr.length; i++) {
    if (masterArr[i][1]) {
      var num = phoneFormatter.normalize(masterArr[i][1])
      var key = "".concat("+1" + num)
      var arr = [masterArr[i][0], key]
      finalArray.push(arr)
    }
  }
  console.log("this is array", finalArray)
  importPhones(finalArray)
}

//Import the phone numbers through the identity api
function importPhones(arr) {
  arr.map(key => {
    const options = {
      method: "POST",
      data: {
        identity: { type: "phone_number", value: key[1] }
      },
      headers: {
        Authorization: "Basic " + process.env.AUTH
      },
      url: process.env.IDENTITYURL + key[0] + "/identities.json"
    }

    axios(options)
      .then(response => {
        console.log(response.status)
        console.log(response.data)
      })
      .catch(error => {
        console.log(error.response)
      })
  })
}

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  )
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  )
  next()
})
app.listen(process.env.PORT || port, function() {
  console.log("App is listening on port " + port)
})
