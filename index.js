#!/usr/bin/env node

const fs = require('fs'),
    path = require('path'),
    { exec } = require('child_process'),
    events = require('events'),
    jobEmitter = new events.EventEmitter(),

    //main job object for tracking job completion & concurent processes
    jobSpecs = {
        thread_limit : 999,
        thread_count : 0,
        jobQueue : [],
        completedJobs : []
    }

//A class instance is created for each job to execute job & track job status
class JobClass {

    constructor(job) {
        this.job_id= job.job_id
        this.program = job.program
    }

    runJob() {
        let _this = this
        if (jobSpecs.thread_count < jobSpecs.thread_limit){
            jobSpecs.thread_count++
            jobEmitter.emit('job-running', this.job_id)
            const child = exec(this.program, function(error, stdout, stderr){
                if (error) {
                    console.error( _this.job_id + ` Failed to execute: ${error}`)
                    return
                }
                if (stdout !== ''){
                    console.log(stdout)
                }
            })
            child.on('exit', code => {
                jobSpecs.thread_count--
                jobEmitter.emit('job-success', _this.job_id)
            })
        }
    }
}

//parse command line arguments determine if single process or server processing
let parseArgs = () => {
    if (process.argv[2] === 'server'){
        if(process.argv[3] !== undefined){
            jobSpecs.thread_limit = process.argv[3]
        } 
        startServer()
        return
    }else if (process.argv[2] === 'process') {
        if (process.argv[3] !== undefined){
            fileName = process.argv[3] 
        }else{
            console.log('missing job filename: `node index.js <fileName> <threadMax>`')
            process.exit()
        }
    }else{
        console.error('invalid command or arguments, see README for usage')
        process.exit()
    }
    if(process.argv[4] !== undefined){
        jobSpecs.thread_limit = process.argv[4]
    } 
    parseJobFile(path.join(__dirname,fileName))
}

//clean txt file and create job array, return job id for api 
let parseJobFile = (filePath) => {
    clearJobs();
    const contents = fs.readFileSync(filePath, 'utf8')
    const regex = /^#(.*)[\n]|\n$/mg // regex matching blank new lines & hash comments
    let lines = contents.replace(regex,'').split('\n') // remove blank lines & comments
    for(let i = 0; i < lines.length; i++){
        let job = {
            job_id : lines[i].split(' ')[1],
            program: lines[i+1].substr(8),
            parent_job_ids: [],
        }
        if (lines[i+2].split(' ')[0] === 'parent_job_ids'){
            job.parent_job_ids = lines[i+2].split(' ').splice(1)
            i++
        }
        i++
        jobSpecs.jobQueue.push(job)
    }
    return jobSpecs.jobQueue[0].job_id
}

let clearJobs = () => { 
    jobSpecs.jobQueue = [] 
    jobSpecs.completedJobs = []
}

//check if any remaining jobs have any incomplete dependencies
let checkDeps = () => {
    for (let k=0; k < jobSpecs.jobQueue.length; k++){
        if (checker(jobSpecs.completedJobs,jobSpecs.jobQueue[k].parent_job_ids)){
            let temp = new JobClass(jobSpecs.jobQueue[k])
            temp.runJob()
        }
    }
}

let checker = (arr, target) => target.every(v => arr.includes(v))

//on completion add job to completion queue and check remaining jobs for dependency
jobEmitter.on('job-success', (job_id) => {
    jobSpecs.completedJobs.push(job_id)
    checkDeps()
})

//remove running jobs from job queue
jobEmitter.on('job-running', (job_id) => {
    jobSpecs.jobQueue = jobSpecs.jobQueue.filter(obj => obj.job_id !== job_id)
})

let run = () => {
    parseArgs()
    checkDeps()
}

run() //main function call



/*********SERVER & API************/

function startServer() {

    const express = require('express'),
        fileUpload = require('express-fileupload'),
        app = express()

    app.use(fileUpload())
    app.use('/css',express.static(__dirname +'/css'));
    app.listen(3000) 


    //serve generic html file with inputs
    app.get('/', function(req, res) {
        res.sendFile(path.join(__dirname + '/index.html'))
    })

    //handle input job status request
    app.get('/status', async (req, res, next) => {
        let jobId = req.query.jobId
        let status = jobSpecs.completedJobs.includes(jobId)
        if (status){
            res.send('success')
        }
        //if the job hasn't completed it will wait the exit event 
        jobEmitter.on('job-success', async (job_id) => {
            if (jobId == job_id){
                try {
                    await res.send('success')
                } catch(error){
                    return;
                }
            }
             
        })
    })


    //handle direct job status request url endpoint
    app.get('/status/:jobId', (req, res, next) => {
        let jobId = req.params.jobId
        let status = jobSpecs.completedJobs.includes(jobId)
        if (status){
            res.send('success')
        }
        //if the job hasn't completed it will wait the exit event 
    
        jobEmitter.on('job-success', async (job_id) => {
            if (jobId == job_id){
                try {
                    await res.send('success')
                } catch(error){
                    return;
                }
            }

        })
    })

    //upload file, begin processing and return job id to client
    app.post('/create-job', function(req, res) {
        if (Object.keys(req.files).length == 0) {
            return res.status(400).send('No files were uploaded.')
        }

        let jobFile = req.files.jobFile
        let filePath = path.join(__dirname, jobFile.name)
      
        jobFile.mv(filePath, function(err) {
            if (err) return res.status(500).send(err)
            let jobId = parseJobFile(filePath)
            res.send(jobId)
            checkDeps()
        })
    })
}

