const express = require("express")
const app = express()
const port = 3000
const axios = require("axios")
const moment = require("moment")
const phoneFormatter = require("phone-formatter")
const helmet = require("helmet")
const schedule = require("node-schedule")
require("dotenv").config()
moment().format()

//this is the scheduler so app runs at 530pm PST everyday
var j = schedule.scheduleJob("22 0 * * *", function() {
  getUsers()
})

//get the user from zendesk
function getUsers() {
  //gets data and subtract one day
  var date = moment()
    .subtract(1, "day")
    .format("YYYY-MM-DD")

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

app.use(helmet())

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
console.log(process.env.PORT)
app.listen(process.env.PORT || port, function() {
  console.log("App is listening on port " + port)
})
