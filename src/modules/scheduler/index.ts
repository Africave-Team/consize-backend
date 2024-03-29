import { Agenda } from "agenda"
import config from '../../config/config'
import "./jobs/sendMessage"
const agenda = new Agenda({
  db: {
    address: `${config.mongoose.url}`,
    collection: "crons",
  }
})

// list the different jobs availale throughout your app
// if you are adding the job types dynamically and saving them in the database you will get it here
let jobTypes = ["sendMessage"]

// loop through the job_list folder and pass in the agenda instance
jobTypes.forEach((type) => {
  // the type name should match the file name in the jobs folder
  require("./jobs/" + type)(agenda)
})

if (jobTypes.length) {
  // if there are jobs in the jobsTypes array set up
  agenda.on("ready", async () => await agenda.start())
}

let graceful = () => {
  agenda.stop()
  process.exit()
}

process.on("SIGTERM", graceful)
process.on("SIGINT", graceful)

export { agenda }