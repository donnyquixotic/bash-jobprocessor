# Project Title

shell command job processor

## Description

The job processor takes an txt file containing one or more jobs that execute shell commands optionally setting dependencies on other parent jobs in the file. It uses Node child-proccesses to run non-dependent jobs concurrently. 

The program can be run standalone to process a single file or can optionally run as a Node/Express server to upload files and check job status via an API.

## Getting Started

### Dependencies

* npm 6.9.0+
* node v10.16.0+

### Installing

* clone repo
* run `npm install`

### Executing program

##Processing a jobs file
* place your jobs file in the home directory of the project `path/to/bash-jobprocessor/<file>`
* each job should be in the following format:
`job_id` - name of the job
`program` - the shell command to be executed when the job is run
`parent_job_ids` - space delimeted list of any other jobs that should be completed before executing
* example:
```
# id identifying job in rest of file.
job_id job1
# program and arguments. run the program through the bash shell.
program cat /tmp/file2 /tmp/file3 /tmp/file4
# jobs depended on.
parent_job_ids job2 job3 job4
job_id job2
program echo hi > /tmp/file2
job_id job3
program echo bye > /tmp/file3
job_id job4
program cat /tmp/file2 > /tmp/file4; echo again >> /tmp/file4
parent_job_ids job2
```
* comments & empty lines are ignored, program commands are expected not to have newlines
* Program can be run using npm scripts or node commands directly and can be run as a one-time processor or as server with API support

* using npm scripts

`npm run process <file_name> <thread_limit>` 

where `file_name` is the local job file and `thread_limit` is an *optional* number indicating an upper limit for how many concurrent jobs should be allowed to execute at any given time, if `thread_limit` is not provided, it will default to 999

##Running the server with API 

`npm run server <thread_limit>`

where `thread_limit` is the same *optional* argument discussed above

This will start the server viewed locally at http://localhost:3000

##API

There are inputs to optionally upload a jobs file or check on a jobs status

You can select a jobs file from anywhere on your local machine and click 'Upload' and it will download the file into the project directory and automatically process it. On successful upload it will return the first `job_id` listed in the file, any `stdout` will be displayed in terminal where server was started.

To check a specific job's status (parent or dependent) you can enter the jobId into the input and click 'Check status'. This will return the status of the job. If it is currently running it will display '...' until it has succeeded, then it will update the status to 'success' 

You can optionally use the endpoint directly to check status using http://localhost:3000/<job_id> 

* using node directly

`node index.js process <file_name> <thread_limit>` 

`node index.js server <thread_limit>`


## Notes

A previous version used a topological sort to arange the jobs in order of dependency as in a directed graph before iterating over the jobs but the execution time difference was negligible for smaller files and my small sample testing showed the topological sort to average a little slower. 

## External modules used

express - https://www.npmjs.com/package/express
express-fileupload - https://www.npmjs.com/package/express-fileupload
