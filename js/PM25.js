var initailPosition = new Cesium.Cartesian3.fromDegrees(120.72798518, 23.9075568876, 1400000);
var initialOrientation = new Cesium.HeadingPitchRoll(0.008593633483712004, -1.5690088150813737, 0);
var homeCameraView = {
    destination: initailPosition,
    orientation: {
        heading: initialOrientation.heading,
        pitch: initialOrientation.pitch,
        roll: initialOrientation.roll
    }
};
viewer.scene.camera.setView(homeCameraView);
homeCameraView.duration = 2.0;
homeCameraView.maximumHeight = 2000;
homeCameraView.pitchAdjustHeight = 2000;
homeCameraView.endTransform = Cesium.Matrix4.IDENTITY;
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (e) {
    e.cancel = true;
    viewer.scene.camera.flyTo(homeCameraView);
})

var listAll = [];
for (let i = 0; i < 1; i++) {
    $.ajax({
        //url: `https://sta.ci.taiwan.gov.tw/STA_AirQuality_Tatung/v1.0/Datastreams?$skip=${i*100}&$expand=Thing($expand=Locations),Observations($orderby=phenomenonTime desc;$top=1)&$filter=name eq 'PM2.5'&$count=true`,
        url: `https://sta.ci.taiwan.gov.tw/STA_AirQuality_v2/v1.0/Datastreams?$expand=Thing,Observations($orderby=phenomenonTime%20desc;$top=1)&$filter=name%20eq%20%27PM2.5%27%20and%20Thing/properties/authority%20eq%20%27%E8%A1%8C%E6%94%BF%E9%99%A2%E7%92%B0%E5%A2%83%E4%BF%9D%E8%AD%B7%E7%BD%B2%27%20and%20substringof(%27%E7%A9%BA%E6%B0%A3%E5%93%81%E8%B3%AA%E6%B8%AC%E7%AB%99%27,Thing/name)&$count=true
        `,
        //url:"./json/Datastream.json",
        async: false,
        success: (d) => {
            //console.log(i + ": " + d.value.length);
            for (let j = 0; j < d.value.length; j++) {
                let temp;
                if (d.value[j]["Observations"][0] !== undefined) {
                    //console.log(d.value[j]["Thing"]["properties"]["city"] + d.value[j]["Thing"]["Locations"][0]["location"]["coordinates"] + ": " + d.value[j]["Observations"][0]["result"] + "µg/m3");
                    temp = {
                        city: d.value[j]["Thing"]["properties"]["city"],
                        //location: d.value[j]["Thing"]["Locations"][0]["location"]["coordinates"],
                        result: d.value[j]["Observations"][0]["result"],
                        //time: d.value[j]["phenomenonTime"]
                    }
                } else {
                    temp = {
                        city: d.value[j]["Thing"]["properties"]["city"],
                        //location: d.value[j]["Thing"]["Locations"][0]["location"]["coordinates"],
                        result: 0.0,
                        //time: d.value[j]["phenomenonTime"]
                    }
                }
                listAll[i * 100 + j] = temp;
            }

        },
        error: () => {
            alert('AJAX failed');
        }
    });
}
console.log(JSON.stringify(listAll));

var geojsonOptions = {
    clampToGround: true
};
var neighborhoodsPromise = Cesium.GeoJsonDataSource.load('../Static/Taiwan.geojson', geojsonOptions);
var neighborhoods;
neighborhoodsPromise.then(function (dataSource) {
    viewer.dataSources.add(dataSource);
    neighborhoods = dataSource.entities;
    var neighborhoodEntities = dataSource.entities.values;
    for (let i = 0; i < neighborhoodEntities.length; i++) {
        var entity = neighborhoodEntities[i];
        var cityName = entity._name;
        //console.log(cityName + ": ");
        let count = 0;
        let sum = 0;
        let ug;
        $.map(listAll, function (item) {
            if (item["city"] === cityName) {
                //console.log(item["result"]);
                sum += item["result"];
                count++;
            }
        })
        if (count > 0) ug = sum / count;

        if (Cesium.defined(entity.polygon)) {
            entity.name = `${cityName}`
            var descript;
            var title;
            var fontColor;
            if (ug >= 251) {
                entity.polygon.material = Cesium.Color.PURPLE;
                title = "危害";
                descript = "健康威脅達到緊急，所有人都有可能受到影響";
                fontColor = "PURPLE";
            } else if (ug >= 55) {
                entity.polygon.material = Cesium.Color.RED;
                title = "對所有族群不健康";
                descript = "對所有人的健康開始產生影響，對於敏感族群可能產生較嚴重的健康影響";
                fontColor = "RED";
            } else if (ug >= 36) {
                entity.polygon.material = Cesium.Color.ORANGE;
                title = "對敏感族群不健康";
                descript = "空氣汙染物可能會對敏感族群的健康造成影響，但對一般大眾的影響不明顯";
                fontColor = "ORANGE";
            } else if (ug >= 16) {
                entity.polygon.material = Cesium.Color.YELLOW;
                title = "普通";
                descript = "空氣品質普通，但對非常少數之極敏感族群造成輕微影響";
                fontColor = "YELLOW";
            } else if (ug >= 0) {
                entity.polygon.material = Cesium.Color.GREEN;
                title = "良好";
                descript = "空氣品質為良好，汙染程度低或無汙染";
                fontColor = "GREEN";
            }
            entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
            var polyPositions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
            var polyCenter = Cesium.BoundingSphere.fromPoints(polyPositions).center;
            polyCenter = Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(polyCenter);
            entity.position = polyCenter;
            if (ug) {
                entity.description = `<table style="width:100%; border-collapse:collapse; font-family: 微軟正黑體;">\
            <tr style="border:1px solid gray;">\
                <th style=" width:50%;">PM2.5即時測量值</th>\
                <td>${ug.toFixed(2)}µg/m3</td>\
            </tr>\
            <tr style="border:1px solid gray;">\
                <th style="color: ${fontColor}; width:50%;">${title}</th>\
                <td>${descript}</td>\
            </tr>\
            </table>`;
            }
            if (ug) entity.polygon.extrudedHeight = ug * 14000;
            entity.polygon.outline = false;
        }
    }
});