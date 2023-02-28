const express = require("express");
const app = express();
app.use(express.json());
const knex = require("knex");
const knexPostgis = require("knex-postgis");
const polylineUtil = require("../TVtS_midlertidig_node_backend/flexible_polyline_util.js");
const cors = require("cors");

app.use(cors());

app.post("/api/generateRoute", async (req, res) => {
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

  await routeQueryF(hereResult.routes[0], db, summaryResult);
  await routeQueryF(hereResult.routes[1], db, summaryResult);
  await routeQueryF(hereResult.routes[2], db, summaryResult);

  const qb = await db
    .withSchema("gis")
    .into(db.raw("gis.route_contained_points(uag_id, route_id)"))
    .insert(function () {
      this.select("uag.id", "routes.id")
        .from("gis.summaries")
        .join("gis.routes", "summaries.id", "routes.summary_id")
        .join(
          db.raw(
            "gis.uag on ST_CONTAINS(ST_Buffer(routes.geom, 20, 'endcap=round join=round'), uag.geom)"
          )
        )
        .where("summaries.id", summaryResult[0].id.toString())
        .groupByRaw("uag.id, routes.id");
    });
  console.log(qb.toString());

  const id = summaryResult[0].id.toString();

  res.send({ id });
});

async function routeQueryF(route, db, summaryResult) {
  const st = knexPostgis(db);

  const sql1 = await db
    .withSchema("gis")
    .insert({
      here_id: route.sections[0].id,
      geom: st.transform(
        st.geomFromText(
          `LINESTRING(${polylineUtil
            .decode(route.sections[0].polyline)
            .polyline.map((i) => i[1] + ` ` + i[0])
            .join(`, `)
            .toString()})`,
          4326
        ),
        25832
      ),
      duration: route.sections[0].travelSummary.duration,
      length: route.sections[0].travelSummary.length,
      mode: route.sections[0].type,
      summary_id: summaryResult[0].id,
    })
    .into("routes");
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, (error) => {
  console.log("Server is running on", PORT);
});
