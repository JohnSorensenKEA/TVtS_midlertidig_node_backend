const fs = require("fs");

let result = `<?xml version="1.0" encoding="ISO-8859-1"?>
<StyledLayerDescriptor version="1.0.0" 
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
    xmlns="http://www.opengis.net/sld" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    xmlns:xlink="http://www.w3.org/1999/xlink" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>Attribute-based polygon</Name>
    <UserStyle>
      <Title>GeoServer SLD Cook Book: Attribute-based point</Title>
      <FeatureTypeStyle>
      `;

function x(s, i) {
  const idk = `<Rule>
      <Name>MedPop</Name>
      <Title>${i * 2 + 1} to ${i * 2 + 2}</Title>
      <ogc:Filter>
      <ogc:And>
        <ogc:PropertyIsGreaterThanOrEqualTo>
          <ogc:PropertyName>num</ogc:PropertyName>
          <ogc:Literal>${i * 2 + 1}</ogc:Literal>
        </ogc:PropertyIsGreaterThanOrEqualTo>
        <ogc:PropertyIsLessThan>
          <ogc:PropertyName>num</ogc:PropertyName>
          <ogc:Literal>${i * 2 + 3}</ogc:Literal>
       </ogc:PropertyIsLessThan>
      </ogc:And>
   </ogc:Filter>
      <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">${s}</CssParameter>
              <CssParameter name="opacity">0.6</CssParameter>
            </Fill>
        <Stroke>
              <CssParameter name="stroke">#0c0d0d</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
              <CssParameter name="opacity">0.7</CssParameter>
        </Stroke>
      </PolygonSymbolizer>
    </Rule>
`;

return idk;
}

fs.readFile("input.txt", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const arr = data.split("\r\n");

  for (let i = 0; i < arr.length; i++) {
    result += x(arr[i], i);
  }

  result += `</FeatureTypeStyle>
  </UserStyle>
</NamedLayer>
</StyledLayerDescriptor>`

  fs.appendFile("output.txt", result, function (err) {
    if (err) throw err;
    console.log("Saved!");
  });
});
