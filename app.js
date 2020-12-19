const express = require("express");
const app = express();

const { mongoose } = require("./db/mongoose");

const { List, Task, User } = require("./db/models");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

  res.header(
    'Access-Control-Expose-Headers',
    'x-access-token, x-refresh-token'
  );

  next();
});

let autenticate = (req, res, next) => {
  let token = req.header('x-access-token');
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      res.status(401).send(err);
    } else {
      req.user_id = decoded._id;
      next();
    }
  });
}

let verifySession = (req, res, next) => {
  let refreshToken = req.header('x-refresh-token');
  let _id = req.header('_id');
  User.findByIdAndToken(_id, refreshToken).then((user) => {
    if (!user) {
      return Promise.reject({
        'error': 'user not found. Make sure that the refresh token and user id are correct '
      });
    }


    req.user_id = user._id;
    req.userObject = user;
    req.refreshToken = refreshToken;
    user.sessions.forEach(session => {
      if (session.token === refreshToken) {
        if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
          isSessionValid = true;
        }
      }
    });

    if (isSessionValid) {
      next();
    } else {
      return Promise.reject({
        'error': 'Refresh token has or the session is invalid'
      });
    }
  }).catch((e) => {
    res.status(401).send(e);
  });

}

app.use(bodyParser.json());

// lists  services 
app.get("/lists", autenticate, (req, res) => {
  List.find({
    _userId: req.user_id
  }).then((lists) => {
    res.send(lists);
  }).catch((e) => {
    res.send(e);
  });
});

app.post("/lists", autenticate, (req, res) => {
  let title = req.body.title;

  let newList = new List({
    title,
    _userId: req.user_id
  });

  newList.save().then((listDoc) => {
    res.send(listDoc);
  });
});

app.patch("/lists/:id", autenticate, (req, res) => {
  List.findOneAndUpdate(
    { _id: req.params.id, _userId: req.user_id },
    {
      $set: req.body,
    }
  ).then(() => {
    res.send({'message':'update successfully'});
  });
});

app.delete("/lists/:id", autenticate, (req, res) => {
  List.findOneAndRemove({
    _id: req.params.id,
    _userId: req.user_id
  }).then((removedListDoc) => {
    res.send(removedListDoc);
    deleteTasksFromList(removedListDoc._id);
  });
});

app.get("/list/:listId/tasks", autenticate, (req, res) => {
  Task.find({
    _listId: req.params.listId,
  }).then((tasks) => {
    res.send(tasks);
  });
});
// task services
app.get("/list/:listId/tasks/:taskId", autenticate, (req, res) => {
  Task.findOne({
    _id: req.params.taskId,
    _listId: req.params.listId,
  }).then((re) => {
    res.send(re);
  });
});

app.post("/list/:listId/tasks", autenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      return true;
    }
    return false;
  }).then((canCreateTask) => {
    if (canCreateTask) {
      let newTask = Task({
        title: req.body.title,
        _listId: req.params.listId,
      });
      newTask.save().then((newTaskDoc) => {
        res.send(newTaskDoc);
      });
    } else {
      res.sendStatus(404);
    }
  });

});

app.patch("/list/:listId/tasks/:taskId", autenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      return true;
    }
    return false;
  }).then((canUpadateTasks) => {
    if (canUpadateTasks) {
      Task.findOneAndUpdate(
        {
          _id: req.params.taskId,
          _listId: req.params.listId,
        },
        {
          $set: req.body,
        }
      ).then(() => {
        res.send({ msg: 'Update successed' });
      });
    } else {
      res.sendStatus(404);
    }
  });

});

app.delete("/list/:listId/tasks/:taskId", autenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
      return true;
    }
    return false;
  }).then((canDeleteTasks) => {
    if (canDeleteTasks) {
      Task.findOneAndRemove({
        _id: req.params.taskId,
        _listId: req.params.listId,
      }).then((re) => {
        res.send(re);
      });
    } else {
      res.sendStatus(404);
    }
  });

});
/* USER ROUTES */

app.post('/users', (req, res) => {
  let body = req.body;
  let newUser = new User(body);
  newUser.save().then(() => {
    return newUser.createSession()
  }).then((refreshToken) => {
    return newUser.generateAccessAuthToken().then((accessToken) => {
      return { accessToken, refreshToken }
    });
  }).then((authoTokens) => {
    res
      .header('x-refresh-token', authoTokens.refreshToken)
      .header('x-access-token', authoTokens.accessToken)
      .send(newUser);
  }).catch((e) => {
    res.status(400).send(e);
  });
});


app.post('/users/login', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  User.findByCredentials(email, password).then((user) => {
    return user.createSession().then((refreshToken) => {
      return user.generateAccessAuthToken().then((accessToken) => {
        return { accessToken, refreshToken }
      });
    }).then((authoTokens) => {
      res
        .header('x-refresh-token', authoTokens.refreshToken)
        .header('x-access-token', authoTokens.accessToken)
        .send(user);
    }).catch((e) => {
      res.status(400).send(e);
    });
  })

});

app.get('/users/me/access-token', verifySession, (req, res) => {
  req.userObject.generateAccessAuthToken().then((accessToken) => {
    res.header('x-access-token', accessToken).send({ accessToken });
  }).catch((e) => {
    res.status(400).send(e);
  });
});


let deleteTasksFromList = (_listId) => {
  Task.deleteMany({
    _listId
  }).then(() => {
    console.log("Tasks from " + _listId + " were deleted");
  });
}
app.listen(3000, () => {
  console.log("server is listing on port 3000");
});

//docker run -d -p 27017:27017  --name manage-tack-mongo mongo:latest
