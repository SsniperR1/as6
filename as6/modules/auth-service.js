const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

let Schema = mongoose.Schema;

let userSchema = new Schema({
  userName: {
    type: String,
    unique: true
  },
  password: String,
  email: String,
  loginHistory: [{
    dateTime: Date,
    userAgent: String
  }]
});

let User;

module.exports.initialize = function() {
  return new Promise(function(resolve, reject) {
    let db = mongoose.createConnection(process.env.MONGODB, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      tlsAllowInvalidCertificates: true, 
      serverSelectionTimeoutMS: 5000 
    });

    db.on('error', (err) => {
      console.error("MongoDB connection error:", err);
      reject(err); 
    });
    
    db.once('open', () => {
      console.log("MongoDB connection successful");
      User = db.model("users", userSchema);
      resolve();
    });
  });
};

module.exports.registerUser = function(userData) {
  return new Promise((resolve, reject) => {
    if (userData.password != userData.password2) {
      reject("Passwords do not match");
    } else {
      bcrypt.hash(userData.password, 10)
        .then(hash => {
          userData.password = hash;
          let newUser = new User(userData);
          newUser.save()
            .then(() => {
              resolve();
            })
            .catch(err => {
              if (err.code === 11000) {
                reject("User Name already taken");
              } else {
                reject(`There was an error creating the user: ${err}`);
              }
            });
        })
        .catch(err => {
          reject("There was an error encrypting the password");
        });
    }
  });
};

module.exports.checkUser = function(userData) {
  return new Promise((resolve, reject) => {
    User.findOne({ userName: userData.userName })
      .exec()
      .then(user => {
        if (!user) {
          reject("Unable to find user: " + userData.userName);
        } else {
          bcrypt.compare(userData.password, user.password)
            .then(result => {
              if (result === true) {
                user.loginHistory.push({
                  dateTime: new Date(),
                  userAgent: userData.userAgent
                });

                User.updateOne(
                  { userName: user.userName },
                  { $set: { loginHistory: user.loginHistory } }
                )
                  .exec()
                  .then(() => {
                    resolve(user);
                  })
                  .catch(err => {
                    reject("There was an error verifying the user: " + err);
                  });
              } else {
                reject("Incorrect Password for user: " + userData.userName);
              }
            })
            .catch(err => {
              reject("There was an error verifying the password: " + err);
            });
        }
      })
      .catch(err => {
        reject("Unable to find user: " + userData.userName);
      });
  });
};