require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("cookie-session")
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const app = express();

const port = process.env.PORT || 5000

mongoose.set('strictQuery', true);
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({
    extended: true
}));


app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    keys: [process.env.keys , process.env.SECRET]

}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect(process.env.MONGODB, {
    useNewUrlParser: true
})

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
    done(null, user.id)
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    })
});



passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://secrets1.onrender.com/auth/google/secrets",
        userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
    },
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({
            googleId: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));

// ========= GET


app.get("/", function (req, res) {
    res.render("home")
})

app.get("/auth/google", passport.authenticate('google', {
    scope: ["profile"]
}));

app.get("/auth/google/secrets",
    passport.authenticate('google', {
        failureRedirect: "/login"
    }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/secrets");
    });

app.get('/auth/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
        failureRedirect: '/login'
    }),
    function (req, res) {
        // Successful authentication, redirect secrets.
        res.redirect('/secrets');
    });


app.get("/login", function (req, res) {
    res.render("login")
})

app.get("/secrets", function (req, res) {
    User.find({
        "secret": {
            $ne: null
        }
    }, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                res.render("secrets", {
                    usersWithSecrets: foundUser
                })
            }
        }
    })
})

app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/")
        }
    });
})

app.get("/register", function (req, res) {
    res.render("register")
})

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login")
    }
})

// ========= POST

app.post("/register", function (req, res) {
    User.register({
        username: req.body.username
    }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets")
            })
        }
    })
});
app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.logIn(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets")
            })
        }
    })
})

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err)
        } else {
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(function () {
                    res.redirect("/secrets")
            })
        }
    }
    })
})


app.listen(port, function () {
    console.log("Server started at port 3000")
})