var APIBuilder = require('@axway/api-builder-runtime');

const axios = require('axios');
var qs = require('qs');

let clientId = process.env.clientId;
let clientSecret = process.env.clientSecret;
let apicentralUrl = process.env.apicentralUrl;

async function getAccessToken() {
	console.log('getAccessToken() called');

  try {

    const response = await axios({
      method: 'post',
      url: 'https://login.axway.com/auth/realms/Broker/protocol/openid-connect/token',
      data: qs.stringify({
        grant_type: 'client_credentials'
      }),
      headers: {
        'Authorization': 'Basic '+Buffer.from(clientId + ':' + clientSecret, 'utf8').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    });

    return {success: true, data: response.data};

  } catch (error) {
    return {success: false, data: error};

  }
}

async function approveSubscriptionRequest(apicentralUrl, catalogItemId, subscriptionId, access_token) {
	console.log('approveSubscriptionRequest() called');

  try {

    const response = await axios({
      method: 'post',
      url: apicentralUrl+'/api/unifiedCatalog/v1/catalogItems/'+catalogItemId+'/subscriptions/'+subscriptionId+'/states',
			data: {
				description: 'Approved via Custom Subsription Flow',
  			state: 'APPROVED'
      },
      headers: {
        'Authorization': 'Bearer '+access_token,
        'content-type': 'application/json'
      }
    });

    return {success: true, data: response.data};

  } catch (error) {
    return {success: false, data: error};
  }
}

function approveSubscription(resp, next, apicentralUrl, catalogItemId, subscriptionId, access_token) {
	console.log('approveSubscription() called');

	approveSubscriptionRequest(apicentralUrl, catalogItemId, subscriptionId, access_token).then(response => {
		if(!response.success) {
			console.log('!!! Subscription Update error!!!');
			sendResponse(resp, next, 400, 'Subscription Update error');
		} else {
			sendResponse(resp, next, 200, 'Success!!!');
		}
	})
}

function sendResponse(resp, next, status, msg) {
	console.log('sendResponse() called');

	resp.response.status(status);
	resp.send(msg);
	next();
}

var intwebhook = APIBuilder.API.extend({
	group: 'webhook',
	path: '/api/intwebhook',
	method: 'POST',
	description: 'Amplify Central API subscription webhook to auto approve API subscription requests',
	parameters: {
		id: {description:'id'},
		time: {description:'time'},
		version: {description:'version'},
		product: {description:'product'},
		correlationId: {description:'correlationId'},
		organization: {description:'organization object'},
		type: {description:'type'},
		payload: {description:'payload object'},
		metadata: {description:'metadata object'}
	},
	action: function (req, resp, next) {

		console.log('intwebhook API called');

		if((req.body.type === 'SubscriptionUpdatedEvent') && (req.body.payload.subscription.currentState === 'REQUESTED')) {
			console.log('Valid API Subscription request received');

			getAccessToken().then(response => {
			  if(!response.success) {
			    console.log('!!! Axway Access Token error, check Client Id and/or Client Secret!!!');
					sendResponse(resp, next, 400, 'Axway access token error');
			  } else {
					approveSubscription(resp, next, 'https://apicentral.axway.com', req.body.payload.catalogItem.id, req.body.payload.subscription.id, response.data.access_token);
			  }
			});

		} else {
			console.log('Nothing to do');
			sendResponse(resp, next, 200, 'Not an API Subscription Request; Nothing to do!!!');
		}

	}
});

module.exports = intwebhook;
