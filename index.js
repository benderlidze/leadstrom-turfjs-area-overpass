//nodejs 
import * as turf from '@turf/turf';
import fetch from 'node-fetch'
import { promises as fsPromises } from 'fs';

fetch("https://serg.one/google-save-poly-api/api_v2.php?session=1cb3aa22-9443-46f0-a080-40823852c1d3")
    .then(response => response.json())
    .then(async data => {
        console.log(data.polygons.polygons);

        const polygons = data.polygons.polygons.map(polygon => {
            console.log('polygon===>', polygon);
            const coords = polygon.map(point => [point.lng, point.lat]);
            const line = turf.lineString(coords.reverse());//right hand rule
            const poly = turf.lineToPolygon(line)

            console.log('JSON.', JSON.stringify(poly));
            return poly;
        });

        const featureCollection = turf.featureCollection(polygons);
        console.log('featureCollection', JSON.stringify(featureCollection));
        const bbox = turf.bbox(featureCollection);
        console.log('bbox', bbox);
        // Calculate the scale factor for the offset (1000 meters)

        const bufferDistance = 1000;
        // Create a buffered polygon with the 500-meter offset
        const bufferedPolygon = turf.buffer(turf.bboxPolygon(bbox), bufferDistance, { units: 'meters' });

        const bufferedBBox = turf.bbox(bufferedPolygon);
        console.log('bboxPolygon', JSON.stringify(bufferedBBox));

        const [x0, y0, x1, y1] = bufferedBBox;//reverse for overpass
        const results = await overpassQuery([y0, x0, y1, x1].join(','), polygons);

        console.log('results', JSON.stringify(results));

    });

const overpassQuery = async (bbox, polygons) => {

    const query = `[out:json];(way["highway"="motorway"](${bbox});way["highway"="trunk"](${bbox}););convert item ::=::,::geom=geom(),_osm_type=type();out geom;`;    // const query = `
    console.log('query', query);

    const api = await fetch('https://www.overpass-api.de/api/interpreter?', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: query
    });
    const overpassResults = await api.json();
    const overpassGeo = overpassResults.elements.map(el => {
        return {
            "type": "Feature",
            "properties": {},
            geometry: el.geometry,
        }
    })

    //console.log('answer', JSON.stringify(geo, null));
    //console.log('osmtogeojson(answer);', JSON.stringify(osmtogeojson(answer)));

    function bufferIntersection(overpassGeo, bufferDistance) {
        const buffer = overpassGeo.map(item => turf.buffer(item, bufferDistance, { units: 'meters' }));
        // console.log('buffer', JSON.stringify(buffer, null));
        // console.log('---------------------------------',);
        const union = buffer.reduce((acc, item) => {
            return turf.union(acc, item);
        });
        // console.log('union', JSON.stringify(union, null));
        const intersection = polygons.map(polygon => {
            return turf.intersect(polygon, union);
        })
        console.log('intersection', JSON.stringify(intersection));
        return intersection;
    }

    //await fsPromises.writeFile('newFile.txt', JSON.stringify(geo, null, 2), 'utf8');


    const m200 = bufferIntersection(overpassGeo, 200)
    const m500 = bufferIntersection(overpassGeo, 500)

    console.log('done');

    return {
        m200,
        m500
    }
}