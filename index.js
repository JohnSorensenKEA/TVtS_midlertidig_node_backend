const express = require("express");
const app = express();
app.use(express.json());
const knex = require("knex");
const knexPostgis = require("knex-postgis");
const polylineUtil = require("../TVtS_midlertidig_node_backend/flexible_polyline_util.js");
const cors = require("cors");
const dbConfig = require("../TVtS_midlertidig_node_backend/db.config.js");
const hereConfig = require("../TVtS_midlertidig_node_backend/here.config.js");

app.use(cors());

app.post("/api/generateRoute", async (req, res) => {
  const time = Date.now();
  let hereResult = {};
  await fetch(
    `https://router.hereapi.com/v8/routes?transportMode=${req.body.mode}&origin=${req.body.origin.lat},${req.body.origin.lon}&destination=${req.body.destination.lat},${req.body.destination.lon}&return=travelSummary,polyline&apikey=${hereConfig.API_KEY}&units=metric&alternatives=2`
  )
    .then((response) => response.json())
    .then((data) => {
      hereResult = data;
    });

  const db = knex({
    client: dbConfig.CLIENT,
    connection: {
      host: dbConfig.HOST,
      port: dbConfig.PORT,
      user: dbConfig.USER,
      password: dbConfig.PASSWORD,
      database: dbConfig.DATABASE,
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

  const bufferToRouteSQL = await db
    .withSchema("gis")
    .into(db.raw("gis.buffered_routes(geom, route_id)"))
    .insert(function () {
      this.select(
        db.raw(
          "ST_Buffer(routes.geom, 20, 'endcap=round join=round'), routes.id"
        )
      )
        .from("gis.summaries")
        .join("gis.routes", "summaries.id", "routes.summary_id")
        .where("summaries.id", summaryResult[0].id.toString());
    });

  const categorizedRoutesSQL = await db
    .withSchema("gis")
    .into(db.raw("gis.categorized_routes(category, route_id)"))
    .insert(function () {
      this.select(db.raw("row_number() over(order by count(uag.*)), routes.id"))
        .from("gis.summaries")
        .join("gis.routes", "summaries.id", "routes.summary_id")
        .join("gis.buffered_routes", "routes.id", "buffered_routes.route_id")
        .join(db.raw("gis.uag on ST_CONTAINS(buffered_routes.geom, uag.geom)"))
        .where("summaries.id", summaryResult[0].id.toString())
        .groupByRaw("routes.id");
    });

  const routeRequest = {
    id: summaryResult[0].id.toString(),
    mode: req.body.mode,
          origin: {
            lat: req.body.origin.lat,
            lon: req.body.origin.lon,
          },
          destination: {
            lat: req.body.destination.lat,
            lon: req.body.destination.lon,
          },
          message: 'Routes successfully generated :>',
  };

  res.send(routeRequest);
});

async function routeQueryF(route, db, summaryResult) {
  if(route === undefined) {
    return;
  }

  let preparedRoute = {
    linestring: { polyline: undefined },
    duration: 0,
    length: 0,
    mode: '',
    summary_id: undefined
  };
  if(route.sections.length > 1) {
    route.sections.forEach(section => {
      preparedRoute.duration += section.travelSummary.duration;
      preparedRoute.length += section.travelSummary.length;
      preparedRoute.mode += `[${section.type}]`;

      if(!preparedRoute.linestring.polyline) {
        preparedRoute.linestring.polyline = polylineUtil.decode(section.polyline).polyline;
      } {
        preparedRoute.linestring.polyline = preparedRoute.linestring.polyline.concat(polylineUtil.decode(section.polyline).polyline);
      }
    })
  } else {
    preparedRoute = {
      linestring: polylineUtil.decode(route.sections[0].polyline),
      duration: route.sections[0].travelSummary.duration,
      length: route.sections[0].travelSummary.length,
      mode: route.sections[0].type
    };
  }
  preparedRoute.summary_id = summaryResult[0].id;


  const st = knexPostgis(db);

  const sql1 = await db
    .withSchema("gis")
    .insert({
      here_id: route.sections[0].id,
      geom: st.transform(
        st.geomFromText(
          `LINESTRING(${preparedRoute.linestring
            .polyline.map((i) => i[1] + ` ` + i[0])
            .join(`, `)
            .toString()})`,
          4326
        ),
        25832
      ),
      duration: preparedRoute.duration,
      length: preparedRoute.length,
      mode: preparedRoute.mode,
      summary_id: preparedRoute.summary_id,
    })
    .into("routes");
}

const PORT = process.env.PORT || 8082;

app.listen(PORT, (error) => {
  console.log("Server is running on", PORT);
});
