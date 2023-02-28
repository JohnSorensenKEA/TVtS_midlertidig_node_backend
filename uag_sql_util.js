const fs = require("fs");

const allFileContents = fs.readFileSync(
  "trafik-ouh-2017-2023-c-points.csv",
  "utf-8"
);

let output = "";

allFileContents.split(/\r?\n/).forEach((line) => {
  const data = line.split(";"); //baar	bmdr	praecis	tidint	alvor14	x	y	modpart	traffikant	weekend

  let date = data[0] + "-";
  if (data[1].length < 2) {
    date += "0" + data[1];
  } else {
    date += data[1];
  }
  date += "-01";

  const sql1 = `INSERT INTO uag("date", geom, time_interval_id, seriousness_id, precision_id, counterparty_id, traffic_type_id, day_type_id) VALUES('${date}', ST_GeomFromText('POINT (${data[5]} ${data[6]})', 25832), ${data[3]}, ${data[4]}, ${data[2]}, ${data[7]}, ${data[8]}, ${data[9]});\n`;

  output += sql1;
});

fs.appendFile("output.txt", output, function (err) {
  if (err) throw err;
  console.log("Saved!");
});
