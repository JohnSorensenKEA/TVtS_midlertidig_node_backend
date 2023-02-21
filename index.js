const express = require("express");
const app = express();
app.use(express.json());
//const { Client } = require("pg");
//const Pool = require("pg").Pool;
//const { Sequelize } = require("sequelize");
const knex = require("knex");
const knexPostgis = require("knex-postgis");
const dotenv = require("dotenv");
const polylineUtil = require("../TVtS_midlertidig_node_backend/flexible_polyline_util.js");
const dbConfig = require("../TVtS_midlertidig_node_backend/db.config.js");
dotenv.config();

app.get("/ap", async (req, res) => {
  try {
    const client = new Client({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT,
    });

    await client.connect();
    const result = await client.query("SELECT * FROM gis.accident_points");
    res.send({ result });
    await client.end();
  } catch (error) {
    console.log(error);
  }
});

app.get("/here", async (req, res) => {
  let result = {};
  await fetch(
    `https://router.hereapi.com/v8/routes?transportMode=pedestrian&origin=55.39228,10.38953&destination=55.39497,10.38106&return=travelSummary,polyline&apikey=UmcH7dm4kGVIOe75j3xIX9SHiN_vLRVn-T1INKq-A-g&units=metric&alternatives=2`
  )
    .then((response) => response.json())
    .then((data) => {
      result = data;
    });
  //console.log(result.routes[0].sections[0].polyline);
  //console.log(polylineUtil.decode(result.routes[0].sections[0].polyline));

  const pri = polylineUtil
    .decode(result.routes[0].sections[0].polyline)
    .polyline.map((i) => i[1] + ` ` + i[0])
    .join(`, `);
  console.log(pri);

  res.send({ result });
});

app.post("/here", async (req, res) => {
  const time = Date.now();
  let hereResult = {};
  await fetch(
    `https://router.hereapi.com/v8/routes?transportMode=${req.body.mode}&origin=${req.body.origin.lat},${req.body.origin.lon}&destination=${req.body.destination.lat},${req.body.destination.lon}&return=travelSummary,polyline&apikey=UmcH7dm4kGVIOe75j3xIX9SHiN_vLRVn-T1INKq-A-g&units=metric&alternatives=2`
  )
    .then((response) => response.json())
    .then((data) => {
      hereResult = data;
    });

  const db = knex({
    client: "pg",
    connection: {
      host: "localhost",
      port: 5434,
      user: "postgres",
      password: null,
      database: "tvts",
    },
  });

  const summaryResult = await db
    .withSchema("gis")
    .insert({
      name: time,
    })
    .into("summaries")
    .returning("id");

  //console.log(summaryResult[0].id);

  //const sql2 = db.select('id', st.asText('geom')).from('gis.accident_points');//.toString();
  //console.log(sql2);

  /*
    //DB test
    db.raw("SELECT * from gis.accident_points").then(response => {
      console.log("PostgreSQL connected");
      console.log(response);
  })
  .catch((e) => {
      console.log("PostgreSQL not connected");
      console.error(e);
  });*/

  /*
    try {
        const client = new Client({
          user: process.env.PGUSER,
          host: process.env.PGHOST,
          database: process.env.PGDATABASE,
          password: process.env.PGPASSWORD,
          port: process.env.PGPORT,
        });

        const summaryQuery = "INSERT INTO gis.summaries(name) VALUES($1) RETURNING *";
        const summaryValues = [req.body.name];

        
        await client.connect();
        const summaryResult = await client.query(summaryQuery, summaryValues);

        await routeQueryF(hereResult.routes[0], client, summaryResult);
        await routeQueryF(hereResult.routes[1], client, summaryResult);
        await routeQueryF(hereResult.routes[2], client, summaryResult);

        
        await client.end();

      } catch (error) {
        console.log(error);
      }*/

  await routeQueryF(hereResult.routes[0], db, summaryResult);
  await routeQueryF(hereResult.routes[1], db, summaryResult);
  await routeQueryF(hereResult.routes[2], db, summaryResult);

  res.send({ time });
});

async function routeQueryF(route, db, summaryResult) {
  const st = knexPostgis(db);

  const sql1 = await db
    .withSchema("gis")
    .insert({
      here_id: route.sections[0].id,
      geom: st.geomFromText(
        `LINESTRING(${polylineUtil
          .decode(route.sections[0].polyline)
          .polyline.map((i) => i[1] + ` ` + i[0])
          .join(`, `)
          .toString()})`,
        4326
      ),
      duration: route.sections[0].travelSummary.duration,
      length: route.sections[0].travelSummary.length,
      mode: route.sections[0].type,
      summary_id: summaryResult[0].id,
    })
    .into("routes");

  //console.log(sql1);

  /*
    const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect/*,
        operatorsAliases: false,
      
        pool: {
          max: dbConfig.pool.max,
          min: dbConfig.pool.min,
          acquire: dbConfig.pool.acquire,
          idle: dbConfig.pool.idle
        }
      });
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
      } catch (error) {
        console.error('Unable to connect to the database:', error);
      }*/
  /*
    const routeValues = [
        route.sections[0].id,
        polylineUtil.decode(route.sections[0].polyline).polyline.map(i => i[1] + ` ` + i[0]).join(`, `).toString(),
        route.sections[0].travelSummary.duration,
        route.sections[0].travelSummary.length,
        route.sections[0].type,
        summaryResult.rows[0].id
    ];
    //console.log(routeValues); // ST_GeomFromText('LINESTRING( , 4326)')
    const routeQuery = "INSERT INTO gis.routes(here_id, geom, duration, length, mode, summary_id) VALUES($1, ST_GeomFromText('LINESTRING ($2)', 4326), $3, $4, $5, $6)";
    await client.query(routeQuery, routeValues);
    */
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, (error) => {
  console.log("Server is running on", PORT);
});
