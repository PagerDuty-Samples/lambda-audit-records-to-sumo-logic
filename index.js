const SumoLogger = require('sumo-logger');
const sumodlogicLink = process.env.sumologic_endpoint
const region = process.env.region
const api_secret_name = process.env.api_secret_name
let startTime, endTime
const AWS = require('aws-sdk')
const axios = require('axios')
const s3 = new AWS.S3();
const stateBucket = process.env.state_bucket
const stateObjectKey = "audittrail-lambda-state-file.txt"
let token = process.env.pagerduty_global_api_token

async function httprequest() {
    console.log("start")
    await setStartTime()
    await retrieveLogs()
    await putStartTime()
    console.log("end")
}

async function setStartTime() {
    console.log(`Bucket ${stateBucket}`)
    console.log(`stateObjectKey ${stateObjectKey}`)
    try {
        let params = {
            Bucket: stateBucket,
            Key: stateObjectKey
        }
        let data = await s3.getObject(params).promise()
        if(data["Body"]) {
            startTime = new Date(parseInt(data["Body"]))
            console.log(`Get Start time ${startTime}`)
        }
    } catch (e) {
        console.log(e)
    }
}

async function putStartTime() {
    try {
        let params = {
            Body: endTime.getTime().toString(),
            Bucket: stateBucket,
            Key: stateObjectKey,
            ServerSideEncryption: 'AES256'
        };

        await s3.putObject(params).promise();
        console.log(`Push Start time ${endTime}`)
    } catch (e) {
        console.log(e)
    }
}

async function retrieveLogs(cursor) {
    let data = await axios({
        method: 'get',
        baseURL: `https://api.pagerduty.com/`,
        url: '/audit/records',
        params: {
            since: startTime.toISOString().slice(0, 19),
            until: endTime.toISOString().slice(0, 19),
            cursor: cursor
        },
        headers: {
            "X-EARLY-ACCESS": "audit-early-access",
            "Content-Type": "application/json",
            "Accept": "application/vnd.pagerduty+json;version=2",
            "Authorization": `Token token=${token}`
        }
    })
    if (data['status'] !== 200) {
        console.error(data)
        return "error"
    }
    let records = data["data"].records
    console.log(`Push Records`, records)
    if(records && records.length > 0) {
        await pushRecords(records)
        if (data["data"].next_cursor) {
            console.log("More")
            await retrieveLogs(data["data"].next_cursor)
        } else {
            console.log("Success")
        }
    } else {
        console.log("Success: Empty")
        return "Success"
    }
}

function pushRecords(records) {
    return new Promise((resolve, reject) => {
        const opts = {
            endpoint: sumodlogicLink,
            onSuccess: () => resolve(),
            onError: () => reject("Error"),
            batchSize: 1000
        };
        const sumoLogger = new SumoLogger(opts)
        records.forEach(record => logEntry(record, sumoLogger))
        sumoLogger.flushLogs()
    })
}

function logEntry(record, sumoLogger) {
    let actors = {}
    if(record.actors) {
        actors = {
            actor_id: record.actors[0].id,
            actor_summary: record.actors[0].summary,
            actor_type: record.actors[0].type
        }
    }
    sumoLogger.log(Object.assign({
            id: record.id,
            request_id: record.execution_context.request_id,
            method_type: record.method.type,
            truncated_token: record.method.truncated_token,
            resource_id: record.root_resource.id,
            resource_type: record.root_resource.type,
            resource_summary: record.root_resource.summary,
            action: record.action,
            details: record.details,
            timestamp: new Date(record.execution_time)}
        , actors))
}

exports.handler = async (event) => {
    startTime = new Date(Date.now() - 1000 * 60 * 180 ) // 3 hours ago
    endTime = new Date(Date.now() - 1000 * 60 * 120 ) // 2 hours ago
    let data = await httprequest()
    return {
        statusCode: 200,
        body: JSON.stringify(data),
    };
};
