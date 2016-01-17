import express from 'express';
import dotenv from 'dotenv';
import twilio from 'twilio';
import Prom from 'bluebird';

const router = express.Router();
dotenv.load();

// create an authenticated client to access the Twilio REST API
let twilioclient = twilio(process.env.TWILIO_MASTER_ACCOUNT_SID, process.env.TWILIO_MASTER_AUTH_TOKEN);


// handle a POST request from Twilio that is triggered by an incoming SMS to our Twilio number
router.post('/', function(request, response) {

  console.log('we have a POST request from Twilio! There is an incoming SMS.');
  console.log('here is the request we received:', JSON.stringify(request.body));
  console.log("trying to get the body message string:", JSON.stringify(request.body.Body));
  console.log("is this the from string?", request.body.From);

  // Get the phone number and message body
  let requesterPhone = request.body.From;
  console.log('requester phone number is:', requesterPhone);
  let requesterMessage = request.body.Body;

  // Deal with images if there are any
  let requesterMediaUrl0 = request.body.MediaUrl0.length !== 0 ? request.body.MediaUrl0 : null;
  //let requesterMediaUrl0 = "/Users/Amit/desktop/Alex.png"
  console.log('may or may not be a media URL:', requesterMediaUrl0);

  // Determine if the incoming SMS is associated with an existing doctor or if it is a user
  function existingDoctorSearch(requesterPhone, requesterMessage) {

    console.log("made it to the existing doctor search");

    let doctorRequest = {};

    switch (requesterPhone) {
        case process.env.CLIENT_NUMBER_1:
          console.log("It is Dr. Lubling");
          doctorRequest = {
            doctor: "Dr. Lubling",
            phone: process.env.CLIENT_NUMBER_1,
            message: requesterMessage
          };
          break;
        case process.env.CLIENT_NUMBER_2:
          console.log("It is Dr. Cleary");
          doctorRequest = {
            doctor: "Dr. Cleary",
            phone: process.env.CLIENT_NUMBER_2,
            message: requesterMessage
          };
          break;
        case process.env.CLIENT_NUMBER_3:
          console.log("It is Dr. Bradford");
          doctorRequest = {
            doctor: "Dr. Bradford",
            phone: process.env.CLIENT_NUMBER_3,
            message: requesterMessage
          };
          break;
        default:
          doctorRequest = null;
    }

    return doctorRequest;

  }

  // parse the doctor's message request looking for a patient number
  function parsePatientNumberAsync(isDoctorRequest){
      return new Promise(function(resolve, reject){

              console.log("made it to the promise to parse the doctor's message for the patient number");

              //  if (err !== null) {
              //    console.log("Error searching for the right user", err);
              //    return reject(err)
              //  };

              let correctPhoneFormat = /([+0-9]){11,}\w+/g;

               if (!isDoctorRequest || isDoctorRequest.message === "") {
                  console.log("returning null, no request or no message from the doctor");
                  resolve(null);
                } else {
                  let patientPhone = isDoctorRequest.message.match(correctPhoneFormat);
                  console.log("returning possible patient's number, doctor's message is good, though no guarantee on number," patientPhone);
                  resolve(patientPhone);
                }

      });
  }


  // Create a message response to the doctor
  function formDoctorMessage(isDoctorRequest, patientPhone) {

    // If the patient number is valid, form a good message, if not, alert the doctor there is a problem and to try again
    if (patientPhone === null || patientPhone.length !== 12 || patientPhone.charAt(0) !== "+") {
      console.log("there is a problem with the patient number, it won't work, inform the doctor");
      // returning an object here with the message and an error to indicate if we should go ahead and send the patient request or not
      let doctorResponse = {
        message: `Hello ${isDoctorRequest.doctor}, thanks for reaching out to Rod and Cone. We've received your request but your patient's number is invalid, please try again.`,
        error: true
      }
      // let message = `Hello ${isDoctorRequest.doctor}, thanks for reaching out to Rod and Cone. We've received your request but your patient's number is invalid, please try again.`
    } else {
      console.log("patient number looks good, let's send a good response to the doctor");
      let doctorResponse = {
        message: `Hello ${isDoctorRequest.doctor}, thanks for reaching out to Rod and Cone. We've received your request and your patient will be notified immediately.`,
        error: false
      }
      // let message = `Hello ${isDoctorRequest.doctor}, thanks for reaching out to Rod and Cone. We've received your request and your patient will be notified immediately.`
    }

    return message;
  }

  // Create a message response to the patient
  function formPatientMessage() {

  }

  // Outbound response function for doctor or patient
  function outboundResponse(message, phone) {

    console.log("sending an outbound message to:", phone);

    // Use the REST client to send a text message
    twilioclient.sendMessage({
        to: phone, // request.param('to'), // this pulls the sms number to send to from the param
        from: process.env.TWILIO_NUMBER,
        body: message
    }, function(err, data) {
        if (err) {
          console.log("error!", err);
        }
        // When we get a response from Twilio, respond to the HTTP POST request
        console.log('here is the data we received:', data);
        response.send('Message is outbound!');
    });

  }

  // Generator that runs synchronously through our workflow
  // let myGen = function* () {
  //
  //   // is this a doctor request or a user texting us?
  //   let isDoctorRequest = existingDoctorSearch();
  //   console.log("is this a doctor?", isDoctorRequest);
  //
  //   // if it's a doctor
  //   if (isDoctorRequest) {
  //
  //     // first check if they've given us a valid patient number for the request
  //     requesterPhone = yield parsePatientNumber();
  //     let doctorMessage = formDoctorMessage(isDoctorRequest);
  //     outboundResponse(doctorMessage, requesterPhone);
  //   }
  //
  //   let outboundMessage = formPatientMessage();
  //   outboundResponse(outboundMessage);
  //
  // };
  // let gen = myGen(); // get the generator ready to run

  // Generator that will synchronously run through our workflow
  Prom.coroutine(function* () {

    // is this a doctor request or a user texting us?
    let isDoctorRequest = existingDoctorSearch(requesterPhone, requesterMessage);
    console.log("is this a doctor?", isDoctorRequest);

    // if it's a doctor
    if (isDoctorRequest) {

      // first check if they've given us a valid patient number for the request
      let patientPhone = yield parsePatientNumberAsync(isDoctorRequest);
      let doctorMessage = formDoctorMessage(isDoctorRequest, patientPhone);
      outboundResponse(doctorMessage.message, isDoctorRequest.phone);
      if (!doctorMessage.error) {
        let outboundMessage = formPatientMessage();
        outboundResponse(outboundMessage, patientPhone);
      }

    } else { // if it's a patient

      // see if they have a validated response, if not reply to that effect, if so process it
      let outboundMessage = formPatientMessage();
      outboundResponse(outboundMessage, requesterPhone);

    }

  })();

});


// handle a GET request that listens for a webhook and sends it out as a text message.
// For now this is just a test to send outgoing SMS
router.get('/', function(request, response) {

    console.log('we have a GET request from the Zendesk webhook, turning it into an outgoing SMS');

    // Use the REST client to send a text message
    twilioclient.sendMessage({
        to: process.env.CLIENT_NUMBER, // request.param('to'), // this pulls the sms number to send to from the param
        from: process.env.TWILIO_NUMBER,
        body: 'Sending a message through Twilio!'
    }, function(err, data) {
        if (err) {
          console.log("error!", err);
        }
        // When we get a response from Twilio, respond to the HTTP POST request
        console.log('here is the data we received:', data);
        response.send('Message is outbound!');
    });

});

module.exports = router;
