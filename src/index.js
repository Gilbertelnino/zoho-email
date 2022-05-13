// setup basic express server
const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
const { LocalStorage } = require("node-localstorage");
const passport = require("passport");
const session = require("express-session");
const ZohoCRMStrategy = require("passport-zoho-crm").Strategy;
const connectDB = require("./database/db");
const User = require("./database/models/user");
const app = express();
const localStorage = new LocalStorage("./scratch");
const fs = require("fs");

dotenv.config();
app.use(express.json());
connectDB();

const PORT = process.env.PORT || 3000;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const scope = [
  "aaaserver.profile.ALL",
  "ZohoMail.messages.ALL",
  "ZohoMail.folders.ALL",
  "ZohoMail.accounts.ALL",
];
const REDIRECT_URL = process.env.REDIRECT_URL;
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function (user, done) {
  return done(null, user);
});

passport.deserializeUser(function (user, done) {
  return done(null, user);
});
passport.use(
  new ZohoCRMStrategy(
    {
      clientID: ZOHO_CLIENT_ID,
      clientSecret: ZOHO_CLIENT_SECRET,
      callbackURL: REDIRECT_URL,
      scope,
      response_type: "code",
      access_type: "offline",
    },
    async (accessToken, refreshToken, profile, done) => {
      // create or not create user if not exist
      const user = await User.findOne({ email: profile.email });
      if (user) {
        const user = {
          profile,
          accessToken,
          refreshToken,
        };
        // set access token and refresh token to user
        localStorage.setItem("user", JSON.stringify(user));

        // set access token in the cookie

        return done(null, user);
      } else {
        const user = await User.create({
          firstName: profile._json.First_Name,
          lastName: profile._json.Last_Name,
          email: profile._json.Email,
          displayName: profile._json.Display_Name,
          accountId: profile._json.ZUID,
        });
        const userData = {
          profile,
          accessToken,
          refreshToken,
        };
        localStorage.setItem("user", JSON.stringify(userData));
        if (user) {
          return done(null, userData);
        }
      }
    }
  )
);

app.get("/auth/zoho-crm/login", (req, res) => {
  res.redirect(
    "https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=" +
      ZOHO_CLIENT_ID +
      "&redirect_uri=" +
      REDIRECT_URL +
      "&scope=" +
      scope.join(",") +
      "&access_type=offline"
  );
});
// app.get("/auth/zoho-crm/login", passport.authenticate("zoho-crm"));

app.get(
  "/auth/zoho/callback",
  passport.authenticate("zoho-crm", {
    failureRedirect: "/failed",
  }),
  (req, res) => {
    res.redirect("/success");
  }
);

// success page
app.get("/success", (req, res) => {
  // get user data from local storage
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }

  return res.sendFile(path.join(__dirname, "../public/success.html"));
});

// read all mails from zoho
app.get("/zoho/mails", async (req, res) => {
  // get user data from local storage
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }
  const userData = JSON.parse(user);

  const { accessToken } = userData;

  const responseAc = await axios.get(" http://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const accountId = responseAc.data.data[0].accountId;

  const response = await axios.get(
    `http://mail.zoho.com/api/accounts/${accountId}/messages/view`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const mailsData = response.data.data;
  res.status(200).json({
    message: "success",
    data: mailsData,
  });
});

app.get("/zoho/account", async (req, res) => {
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }
  const userData = JSON.parse(user);
  const {
    accessToken,
    refreshToken,
    profile: {
      _json: { ZUID },
    },
  } = userData;
  const response = await axios.get(" http://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status(200).json({
    message: "success",
    data: response.data,
  });
});

app.get("/zoho/folder", async (req, res) => {
  // get user data from local storage
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }
  const userData = JSON.parse(user);

  const { accessToken } = userData;

  const responseAc = await axios.get(" http://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const accountId = responseAc.data.data[0].accountId;

  // get all forlder details
  const folderUrl = `https://mail.zoho.com/api/accounts/${accountId}/folders`;
  const folderData = await axios.get(folderUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const mailsData = folderData.data;
  res.status(200).json({
    message: "success",
    data: mailsData,
  });
});

app.get("/zoho/attachments", async (req, res) => {
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }
  const userData = JSON.parse(user);

  const { accessToken } = userData;

  const responseAc = await axios.get(" http://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const accountId = responseAc.data.data[0].accountId;

  const response = await axios.get(
    `http://mail.zoho.com/api/accounts/${accountId}/messages/view`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const mailsData = response.data.data;

  // get all attachments
  // url: http://mail.zoho.com/api/accounts/<accountId>/folders/folderid/messages/<messageId>/attachmentinfo

  // get folder ids from mailsData
  const attachments = [];
  for (let i = 0; i < mailsData.length; i++) {
    const messageId = mailsData[i].messageId;
    const folderId = mailsData[i].folderId;
    const folderUrl = `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachmentinfo`;
    const attachmentData = await axios.get(folderUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    attachments.push(attachmentData.data);
  }
  return res.status(200).json({
    message: "success",
    data: attachments,
  });
});

// download attachment
app.get("/zoho/attachment/download", async (req, res) => {
  const user = localStorage.getItem("user");
  if (!user) {
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }
  const userData = JSON.parse(user);

  const { accessToken } = userData;

  const responseAc = await axios.get(" http://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const accountId = responseAc.data.data[0].accountId;

  const response = await axios.get(
    `http://mail.zoho.com/api/accounts/${accountId}/messages/view`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const mailsData = response.data.data;

  // get all attachments
  // url: http://mail.zoho.com/api/accounts/<accountId>/folders/folderid/messages/<messageId>/attachmentinfo

  // get attachements from mailsData
  let attachments = [];
  for (let i = 0; i < mailsData.length; i++) {
    const messageId = mailsData[i].messageId;
    const folderId = mailsData[i].folderId;
    const folderUrl = `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachmentinfo`;
    const attachmentData = await axios.get(folderUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (attachmentData.data.data.attachments.length > 0) {
      attachments = [
        ...attachments,
        {
          attachement: attachmentData.data.data.attachments.map(
            (attachment) => {
              return {
                ...attachment,
                messageId,
                folderId,
              };
            }
          ),
        },
      ];
    }
  }

  // loop through attachements and download Attachment from attachments and save it in attachements folder
  // console.log("attachments", attachments);
  for (let i = 0; i < attachments.length; i++) {
    const { attachement } = attachments[i];
    // console.log("attachement", attachement);
    for (let j = 0; j < attachement.length; j++) {
      // attachments array
      const { attachmentId, attachmentName, folderId, messageId } =
        attachement[j];
      // // URL: https://mail.zoho.com/api/accounts/<accountId>/folders/<folderId>/messages/<messageId>/attachments/<attachId>
      const attachmentUrl = `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachments/${attachmentId}`;
      const attachmentData = await axios.get(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = attachmentData.data;
      const buffer = Buffer.from(data, "base64");
      // console.log("data::::", data);
      // // save attachment in attachments folder

      // create folder if it doesn't exist
      if (!fs.existsSync("./public/attachments")) {
        fs.mkdirSync("./public/attachments");
      }

      // create file and write stream to it
      const file = fs.createWriteStream(
        `./public/attachments/${attachmentName}`
      );
      file.write(buffer);
      file.end();
    }
  }
  // res.status(200).json({ message: "success", attachments });
  return res.sendFile(path.join(__dirname, "../public/download-success.html"));
});

// logout
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
