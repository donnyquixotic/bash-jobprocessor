#!/usr/bin/env node

const fs = require('fs'),
    path = require('path'),
    { exec } = require('child_process'),
    express = require("express"),
    app = express(),
    fileUpload = require('express-fileupload'),
    events = require('events'),
    myEmitter = new events.EventEmitter(),
    jobSpecs = {
        thread_limit : 9999,
        thread_count : 0,
        jobQueue : [],
        completedJobs : []
    }

class JobClass {

    constructor(job) {
        this.job_id= job.job_id;
        this.program = job.program;
    }

    runJob() {
        var _this = this;
        if (jobSpecs.thread_count < jobSpecs.thread_limit){
            jobSpecs.thread_count++
            myEmitter.emit('job-running', this.job_id);
            const child = exec(this.program, function(error, stdout, stderr){
                if (error) {
                    console.error( _this.job_id + ` Failed to execute: ${error}`);
                    return;
                }
                if (stdout !== ''){
                    console.log(stdout);
                }
            })
            child.on('exit', code => {
                jobSpecs.thread_count--
                myEmitter.emit('job-success', _this.job_id);
            })
        }
    }
}

let run = () => {
    // startServer()
    parseArgs()
    checkDeps()
}

let startServer = () => {
    app.use(fileUpload());
    app.listen(3000)
    app.get('/', function(req, res) {
        res.sendFile(path.join(__dirname + '/index.html'));
    });

    app.get("/status", (req, res, next) => {
        let result = 'job is running...'
        let jobId = req.query.jobId;
        let status = jobSpecs.completedJobs.includes(jobId);
        if (status){
            result = 'success'
        }
        res.json([result])
    });

    app.get("/status/:jobId", (req, res, next) => {
        let result = '...'
        let jobId = req.params.jobId;
        let status = jobSpecs.completedJobs.includes(jobId);
        if (status){
            result = 'success'
        }
        res.json(result)
    });

    app.post('/create-job', function(req, res) {
        if (Object.keys(req.files).length == 0) {
          return res.status(400).send('No files were uploaded.');
        }
        let jobFile = req.files.jobFile;

        let filePath = path.join(__dirname, jobFile.name);
      
        jobFile.mv(filePath, function(err) {
          if (err)
            return res.status(500).send(err);
          let jobId = parseJobFile(filePath)
          res.send(jobId);
          checkDeps();
        });
      });
}

let parseArgs = () => {
    console.dir(process.argv)
    if (process.argv[2] === 'server'){
        if(process.argv[3] !== undefined){
            jobSpecs.thread_limit = process.argv[3]
        } 
        startServer();
        return;
    }else if (process.argv[2] === 'process') {
        if (process.argv[3] !== undefined){
            fileName = process.argv[3] 
        }else{
            console.log("missing job filename: `node index.js <fileName> <threadMax>`")
            process.exit()
        }
    }else{
        console.error("invalid command or arguments, see README for usage")
        process.exit()
    }
    if(process.argv[4] !== undefined){
        jobSpecs.thread_limit = process.argv[4]
    } 
    parseJobFile(path.join(__dirname,fileName));
}

let parseJobFile = (filePath) => {
    const contents = fs.readFileSync(filePath, 'utf8')
    const regex = /^#(.*)[\n]|\n$/mg; // regex matching blank new lines & hash comments
    let lines = contents.replace(regex,"").split('\n') // remove blank lines & comments
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
        jobSpecs.jobQueue.push(job);
    }
    return jobSpecs.jobQueue[0].job_id; 
}

//check if any remaining jobs have any incomplete dependencies
let checkDeps = () => {
    for (let k=0; k < jobSpecs.jobQueue.length; k++){
        if (checker(jobSpecs.completedJobs,jobSpecs.jobQueue[k].parent_job_ids)){
            let temp = new JobClass(jobSpecs.jobQueue[k]);
            temp.runJob();
        };
    }
}

let checker = (arr, target) => target.every(v => arr.includes(v));

myEmitter.on('job-success', (job_id) => {
    //on completion add job to completion queue and check remaining jobs for dependency
    jobSpecs.completedJobs.push(job_id);
    checkDeps();
})

myEmitter.on('job-running', (job_id) => {
    //remove running jobs from job queue
    jobSpecs.jobQueue = jobSpecs.jobQueue.filter(obj => obj.job_id !== job_id);
})

run(); //main function call
