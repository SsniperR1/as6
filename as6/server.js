/********************************************************************************
*  WEB322 – Assignment 06
* 
*  I declare that this assignment is my own work in accordance with Seneca's
*  Academic Integrity Policy:
* 
* https://www.senecapolytechnic.ca/about/policies/academic-integrity-policy.html
* 
*  Name: mohammed taha zniber Student ID: 149167231 Date: 2025-08-11
*
*  Published URL: https://as6-i3qnbjzg-tahas-projects.vercel.app
*
********************************************************************************/

const express = require("express");
const path = require("path");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;
const clientSessions = require("client-sessions");

const projectData = require("./modules/projects");

const authData = require("./modules/auth-service");

app.use(clientSessions({
  cookieName: "session",
  secret: "climate_solutions_web322_app",
  duration: 30 * 60 * 1000, 
  activeDuration: 10 * 60 * 1000 
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set('views', __dirname + '/views');

app.get("/", (req, res) => {
  res.render("home", { page: "/" });
});

app.get("/about", (req, res) => {
  res.render("about", { page: "/about" });
});

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: "", userName: "" });
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  
  authData.checkUser(req.body)
    .then((user) => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory
      };
      res.redirect('/solutions/projects');
    })
    .catch(err => {
      res.render("login", { errorMessage: err, userName: req.body.userName });
    });
});

app.get("/register", (req, res) => {
  res.render("register", { errorMessage: "", successMessage: "", userName: "" });
});

app.post("/register", (req, res) => {
  authData.registerUser(req.body)
    .then(() => {
      res.render("register", { errorMessage: "", successMessage: "User created", userName: "" });
    })
    .catch(err => {
      res.render("register", { errorMessage: err, successMessage: "", userName: req.body.userName });
    });
});

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect('/');
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render("userHistory", { page: "/userHistory" });
});

app.get("/solutions/projects", (req, res) => {
  if (req.query.sector) {
    projectData.getProjectsBySector(req.query.sector)
      .then((data) => {
        res.render("projects", { projects: data, page: "/solutions/projects" });
      })
      .catch((err) => {
        console.log(`Error loading projects with sector ${req.query.sector}:`, err);
        res.render("projects", { projects: [], page: "/solutions/projects" });
      });
  } else {
    projectData.getAllProjects()
      .then((data) => {
        res.render("projects", { projects: data, page: "/solutions/projects" });
      })
      .catch((err) => {
        console.log("Error loading all projects:", err);
        res.render("projects", { projects: [], page: "/solutions/projects" });
      });
  }
});

app.get("/solutions/projects/:id", (req, res) => {
  projectData.getProjectById(req.params.id)
    .then((data) => {
      res.render("project", { project: data });
    })
    .catch((err) => {
      res.status(404).render("404", { message: `Project with id ${req.params.id} cannot be found.` });
    });
});

app.get("/solutions/addProject", ensureLogin, (req, res) => {
  projectData.getAllSectors()
    .then(sectors => {
      res.render("addProject", { sectors: sectors, page: "/solutions/addProject" });
    })
    .catch(err => {
      console.log("Error loading sectors:", err);
      res.render("addProject", { sectors: [], page: "/solutions/addProject" });
    });
});

app.post("/solutions/addProject", ensureLogin, (req, res) => {
  projectData.addProject(req.body)
    .then(() => {
      res.redirect("/solutions/projects");
    })
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.get("/solutions/editProject/:id", ensureLogin, (req, res) => {
  Promise.all([
    projectData.getProjectById(req.params.id),
    projectData.getAllSectors()
  ])
    .then(([project, sectors]) => {
      res.render("editProject", { project: project, sectors: sectors, page: "" });
    })
    .catch(err => {
      res.status(404).render("404", { message: err });
    });
});

app.post("/solutions/editProject", ensureLogin, (req, res) => {
  projectData.editProject(req.body.id, req.body)
    .then(() => {
      res.redirect("/solutions/projects");
    })
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.get("/solutions/deleteProject/:id", ensureLogin, (req, res) => {
  projectData.deleteProject(req.params.id)
    .then(() => {
      res.redirect("/solutions/projects");
    })
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.use((req, res) => {
  res.status(404).render("404", { message: "I'm sorry, we're unable to find what you're looking for" });
});

if (require.main === module) {
  Promise.all([projectData.initialize(), authData.initialize()])
    .then(() => {
      app.listen(HTTP_PORT, () => {
        console.log(`app listening on: ${HTTP_PORT}`);
      });
    })
    .catch((err) => {
      console.log(`unable to start server: ${err}`);
    });
}


let initialized = false;

app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      await Promise.all([projectData.initialize(), authData.initialize()]);
      initialized = true;
    } catch (err) {
      console.log(`Error initializing: ${err}`);
      return res.status(500).render("500", { 
        message: "Failed to initialize database connection" 
      });
    }
  }
  next();
});

module.exports = app;