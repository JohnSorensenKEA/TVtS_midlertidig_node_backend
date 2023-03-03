const fs = require("fs");

function generateSQL(name1, severity, traffic, counter, kommune) {
    let severity_id = '';
    let severityBool = true;
    
    let counterBool = true;
    let counter_id = '';
    
    let trafficBool = true;
    let traffic_id = '';

    if (severity === 'alvor') {
        severity_id = '= 2';
    } else if (severity === 'mindre') {
        severity_id = '= 1';
    } else {
        severityBool = false;
    }

    if(traffic === 'motor'){
        traffic_id = '= 2';
    }else if (traffic === 'bloed'){
        traffic_id = '= 1';
    } else {
        trafficBool = false;
    }

    if(counter === 'motor'){
        counter_id = '= 2';
    }else if (counter === 'bloed'){
        counter_id = '= 1';
    }else if(counter === 'andet') {
        counter_id = '!= 2';
    } else {
        counterBool = false;
    }

    let tableName = `uag_${name1.toLowerCase()}${severityBool ? '_' + severity : ''}${trafficBool ? '_' + traffic : ''}${counterBool ? '_' + counter : ''}`;

  let sql1 = `
create table gis.${tableName} (
	id serial primary key,
	num int not null,
	geom geometry not null
);

insert into gis.${tableName} (num, geom)
select COUNT(u.id) as num_accidents, dme.geom from gis.dkn_100m_uag_count_relation dmucr
join gis.dkn_100m_euref89 dme on dmucr.dkn_id = dme.id
join gis.uag u on ST_CONTAINS(dme.geom, u.geom)
left join gis.uag_kommune_relations ukr on u.id = ukr.uag_id 
left join gis."Kommune" k on ukr.kommune_id = k.id
where dmucr.id > 0 ${kommune ? 'and k.navn = \'' + name1 +' Kommune\'' : ''} ${severityBool ? ' and u.seriousness_id ' + severity_id : ''}${trafficBool ? ' and u.traffic_type_id ' + traffic_id : ''}${counterBool ? ' and u.counterparty_id ' + counter_id : ''}
group by dme.id;

alter table gis.${tableName} 
alter column geom
type public.geometry("MultiPolygon" , 25832)
using ST_SetSRID(geom, 25832);

`;

return sql1;
}

function firstStep(name1, kommune) {
    let res = '';
    //generateSQL(name1, severity, traffic, counter, kommune);
    res += generateSQL(name1, '', '', '', kommune);
    res += generateSQL(name1, 'alvor', '', '', kommune);
    res += generateSQL(name1, 'mindre', '', '', kommune);

    res += generateSQL(name1, 'alvor', 'motor', 'ingen', kommune);
    res += generateSQL(name1, 'alvor', 'motor', 'motor', kommune);
    res += generateSQL(name1, 'alvor', 'bloed', 'motor', kommune);
    res += generateSQL(name1, 'alvor', 'bloed', 'andet', kommune);

    res += generateSQL(name1, 'mindre', 'motor', 'ingen', kommune);
    res += generateSQL(name1, 'mindre', 'motor', 'motor', kommune);
    res += generateSQL(name1, 'mindre', 'bloed', 'motor', kommune);
    res += generateSQL(name1, 'mindre', 'bloed', 'andet', kommune);

    return res;
}

let result = ``;

result += firstStep('alle', false);
result += firstStep('Odense', true);
result += firstStep('Nordfyns', true);

fs.appendFile("output.txt", result, function (err) {
    if (err) throw err;
    console.log("Saved!");
});