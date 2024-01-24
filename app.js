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
app.use(bodyparser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Ophalen van home pagina.
app.get("/", function (req, res) {
  return res.render("index");
});

// Ophalen van registratie pagina.
app.get("/regri", function (req, res) {
  return res.render("regri");
});

app.get("/mainpage", async function (req, res) {
  try {
    if (!req.session.user)
      return res.redirect("/");

    const exchangeRates = await fetchExchangeRatesFromDatabase();
    return res.render("mainpage", {
      user: req.session.user,
      exchangeRates: JSON.stringify(exchangeRates)
    });
  } catch (error) {
    return res.send("Error fetching data. Error message: " + error);
  }
});

app.get("/update-exchange-rates", async function (req, res) {
  try {
    const apiResponse = await makeApiRequest();
    updateDatabase(apiResponse);

    // Na het bijwerken van de database, haal de gegevens opnieuw op en stuur ze naar de frontend
    const exchangeRates = await fetchExchangeRatesFromDatabase();
    return res.status(200).json(exchangeRates);
  } catch (error) {
    return res.status(500).json({ error: "Error updating or fetching data." });
  }
});

// Functie om gegevens uit de database op te halen
async function fetchExchangeRatesFromDatabase() {
  return new Promise((resolve, reject) => {
    connection.query("SELECT * FROM currencyexchangerates", function (error, results) {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

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
  try {
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

    console.log(request.data); // Print de gegevens van de API-aanvraag
    return request.data;
  } catch (error) {
    console.error('Fout bij het maken van de API-aanvraag:', error);
    throw error; // Je kunt ervoor kiezen om de fout door te geven aan de aanroeper
  }
}


async function updateDatabase(apiData) {
  const exchangeRateData = apiData['Realtime Currency Exchange Rate'];

  try {
      const query = `
          INSERT INTO currencyexchangerates 
          (FromCurrencyCode, FromCurrencyName, ToCurrencyCode, ToCurrencyName, ExchangeRate, LastRefreshed, TimeZone, BidPrice, AskPrice) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          ExchangeRate = VALUES(ExchangeRate), 
          LastRefreshed = VALUES(LastRefreshed), 
          TimeZone = VALUES(TimeZone), 
          BidPrice = VALUES(BidPrice), 
          AskPrice = VALUES(AskPrice)`;

      const values = [
          exchangeRateData['1. From_Currency Code'],
          exchangeRateData['2. From_Currency Name'],
          exchangeRateData['3. To_Currency Code'],
          exchangeRateData['4. To_Currency Name'],
          exchangeRateData['5. Exchange Rate'],
          exchangeRateData['6. Last Refreshed'],
          exchangeRateData['7. Time Zone'],
          exchangeRateData['8. Bid Price'],
          exchangeRateData['9. Ask Price']
      ];

      await connection.promise().query(query, values);

      console.log('Database bijgewerkt met API-gegevens.');
  } catch (error) {
      console.error('Fout bij het bijwerken van de database:', error);
      throw error;
  }
}


// Luisteren op een poort (bijvoorbeeld 3000)
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});