### Testing Tasks

- [ ] Improve coverage
- [x] Add paginate tests
- [x] Add toJSON tests

### Other Tasks

- [x] Have faker.js as a dev dependency
- [ ] Add Cookie Support

reminders

- when block ends


- reminder db records
 - course
 - student
 - count(of reminders sent today) (reset to 0 at the start of the day)
 - days(since last activity)  (reset to 0 whenever the user takes any lesson block)

- on enrollment
  - start daily notification routine for this course. the handler does the following
    - check if number of days without activity is equal to reminderDays period
      - if less
          - schedule all daily reminder


- on end of lesson
  - get db records
  - if the type of dropout message is "end_of_lesson"
    - if record.days is not equal to the dropout wait period 
      - remove all dropout schedules
    - schedule dropout message using the dropout wait period value

- daily reminder (param: last(bool))
  - get db records
  - increment count
  - if last is true
    - increment db record days
    - if the type of dropout message is "inactivity"
      - check if days equals the dropout wait period 
        - if its equal
          - send dropout message




- on block end/quiz end
  - if there is still lessons left to complete daily min lessons
  - if there's still blocks left in the current lesson
    - if reminder exists, delete
    - schedule a reminder using the inactivity period value
