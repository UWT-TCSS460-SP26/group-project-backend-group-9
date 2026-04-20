# Meeting Minutes

## Meeting 1 — First Team Meeting

**Meeting Manager:** Raiden H  
**Meeting Scribe:** Saeed Esparza

---

### Agenda Item 1: Meeting Manager

Raiden H was decided as the Meeting Manager.

### Agenda Item 2: Meeting Scribe

Saeed Esparza was decided as the Meeting Scribe.

### Agenda Item 3: Get to Know Each Group Member

**What is your name/nickname and what do you prefer to be called?**

- Raiden: Raiden
- Riley: Riley
- Saeed: Saeed

**Where did you do Freshman/Sophomore year and/or where did you take 142/143? Did your 142/143 prepare you for this course?**

- Raiden: SSPCC for both, and yes (no).
- Riley: Pierce, no.
- Saeed: UWT, no.

**What are your programming strengths and weaknesses?**

- Raiden: Good at documentation, figuring out doing things, but not the best at doing things the best.
- Riley: Good at low level stuff but not high level. Back end pretty well.
- Saeed: Good at terminology but not good at implementation.

**What other obligations take time away from your ability to work on this project?**

- Raiden: School, TTh is completely booked.
- Riley: School, project in digital design, labs, IEEE project.
- Saeed: Project, TTh, gym.

**What is something you want others to know about yourself?**

- Raiden: Draws sometimes.
- Riley: Currently training for a marathon.
- Saeed: Makes music, nonstop applying, likes cars.

### Agenda Item 4: Group Structure

- No dedicated group leader.
- Saeed can read JavaScript well and is the Claude/AI expert.
- Raiden and Riley are the GitHub experts.

### Agenda Item 5: Concerns and Expectations

- Raiden: Had teammates not doing much in the past but made it through. Goal: establish open and good communication.
- Riley: Had a miserable group project in 360 because one member chose not to do work during the last week.
- Strategy: maintain open communication and hold each other accountable.

### Agenda Item 6: Meeting Schedule

The group will meet synchronously at least 3 times a week:

- Monday at 4:00 PM
- Tuesday at 3:30 PM
- Friday at 1:00 PM

### Agenda Item 7: Wrap-up

Meeting concluded.

## Meeting 2 — Monday, April 13 2026

**Meeting Scribe:** Saeed Esparza

---

### Agenda Item 1: Project Management

Raiden created a Kanban board for us to get a sense of direction for sprints.
We came to a general consensus of how we want the codebase to be organized.

### Agenda Item 2: Search Population/Handling

Riley brought up how details may get muddied when detail items get jumbled.
Raiden brought up that it would not get jumbled, it will simply populate the search.
Raiden brought up that we should maybe give TV shows and movies different endpoints.

### Agenda Item 2: Tasks

Raiden created four tasks for us to self-assign.

### Agenda Item 3: Wrap-up

Saeed got the API keys necessary.

Meeting concluded.

## Meeting 4 — Friday, April 17 2026

**Meeting Scribe:** Saeed Esparza

---

### Agenda Item 1: Task Progress

The team went over their current progress on the self-assigned tasks.
No one indicated issues with their progress.
Everyone self-assigned tasks as needed for the final integrations to complete the sprint.

### Agenda Item 2: Wrap-up

Talked about when we estimate we would be done with our tasks and had PRs reviewed soon after.

Meeting concluded.


## Meeting 5 — Friday, April 20 2026

**Meeting Scribe:** Riley Hopper

### Agenda Item 1: Project Management.

We went back over the general structure that we did in the previous week,  decided to keep the same kanban board style.


### Agenda Item 2: Data Base Structure.

Raiden started by creating the the general structure of the table, discussing general questions with the group about what elements should be within the table. We decided on only having tables for users, and reviews. We decided on this schema bellow:

```SQL
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  media_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 and 10),
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  isMovie BOOLEAN DEFAULT true,
  UNIQUE (user_id, media_id)
);
```


Quick fire bullet list:
- We decided to have all the reviews a user made be deleted with them.
- 

### Agenda Item 3: Setting up deliverables.

We quickly setup the deliverables.

Meeting end
