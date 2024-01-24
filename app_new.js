const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql2 = require('mysql2');
const crypto = require('crypto');
const bodyparser = require('body-parser');
const axios = require('axios');

const app = express();

const connection = mysql2.createConnection({
    host: "localhost",
    user: "root",
    password: null,
    database: "apimaatjes"
});

connection.connect();

app.use(session({
    secret: "fatihs-geheime-wachtwoord",
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.urlencoded({extended: true}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Ophalen van home pagina.
app.get("/", function(req, res) {
    return res.render("index");
});

// Ophalen van registratie pagina.
app.get("/regri", function(req, res) {
    return res.render("regri");
});

app.get("/mainpage", function(req, res) {

    if(!req.session.user)
        return res.redirect("/");

    connection.query("SELECT * FROM currencyexchangerates", function(error, results) {

        if(error) 
            return res.send("Error fetching data. Error message: " + error);

        return res.render("mainpage", {
            user: req.session.user,
            exchangeRates: JSON.stringify(results)
        });
    });
});

app.get("/update-exchange-rates", async function(req, res) {

    const apiResponse = await makeApiRequest();

    updateDatabase(apiResponse);

    return res.status(200).json(apiResponse);
});

// app.post("/login", function(req, res) {

//     const { username, password } = req.body;

//     if(!(username && password))
//         return res.send("Vul zowel gebruikersnaam als wachtwoord in.");

//     connection.query("SELECT * FROM users WHERE name = ?", [username], function(error, results) {


//     });
// });
app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    if (username && password) {
      connection.query('SELECT * FROM users WHERE name = ?', [username], (error, results) => {
        if (error) {
          console.error(error);
          res.send('Er is een fout opgetreden bij het inloggen.');
        } else {
          if (results.length > 0) {
            const user = results[0];
            const hashedPassword = generateHash(password);
  
            if (hashedPassword === user.password) {
              // Sla de gebruiker op in de sessie
              req.session.user = user;
              res.redirect('/mainpage');
            } else {
              res.send('Ongeldige inloggegevens.');
            }
          } else {
            res.send('Gebruiker niet gevonden.');
          }
        }
      });
    } else {
      res.send('Vul zowel gebruikersnaam als wachtwoord in.');
    }
  });

  app.post('/register', async function (req, res) {
    const { name, email, password, confirmPassword } = req.body;
  
    // Validate password and confirmPassword
    if (password !== confirmPassword) {
      return res.status(400).send('Passwords do not match');
    }
  
    // Hash the password using SHA-256 before storing it in the database
    const hashedPassword = generateHash(password);
  
    // Perform the database insertion logic here
    const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    connection.query(insertQuery, [name, email, hashedPassword], function (err, results) {
      if (err) {
        console.error('Error executing registration query: ', err);
        return res.status(500).send('Error registering user');
      }
  
      console.log('User registered successfully');
      // Redirect to the index page after successful registration
      res.redirect('/');
    });
  });
  
  
  // Functie om een hash te genereren zonder zout
  function generateHash(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
  }
async function makeApiRequest() {

    const request = await axios.get("https://alpha-vantage.p.rapidapi.com/query", {
        method: 'GET',
        url: 'https://alpha-vantage.p.rapidapi.com/query',
        params: {
          from_currency: 'BTC',
          function: 'CURRENCY_EXCHANGE_RATE',
          to_currency: 'USD'
        },
        headers: {
          'X-RapidAPI-Key': '5e7ec0e843msh97c8adffc9add65p1a55d8jsn6a3e1f5a141b',
          'X-RapidAPI-Host': 'alpha-vantage.p.rapidapi.com'
        }
    });

    return request.data;
}

async function updateDatabase(data) {

    try {

        const query = "UPDATE `currencyexchangerates` SET `Id`='[value-1]',`FromCurrencyCode`='[value-2]',`FromCurrencyName`='[value-3]',`ToCurrencyCode`='[value-4]',`ToCurrencyName`='[value-5]',`ExchangeRate`='[value-6]',`LastRefreshed`='[value-7]',`TimeZone`='[value-8]',`BidPrice`='[value-9]',`AskPrice`='[value-10]' WHERE 1";


    } catch(err) {
        
    }
}

// Luisteren op een poort (bijvoorbeeld 3000)
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});