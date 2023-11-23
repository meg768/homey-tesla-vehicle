
async function getLocationName(latitude, longitude) {

    try {
        let Request = require('./request.js');
        let request = new Request('https://nominatim.openstreetmap.org');
    
        let query = {
            lat: latitude,
            lon: longitude,
            format: 'geocodejson'
        };
    
        let headers = {
            'user-agent': `what-ever/${Math.round(Math.random() * 100)}`
        };

        let response = await request.get('reverse', {headers:headers, query:query});
        let geocode = response.body.features[0].properties.geocoding;
    
        if (geocode.name && geocode.city) {
            return `${geocode.name}, ${geocode.city}`;
        }
    
        if (geocode.housenumber && geocode.city && geocode.street) {
            return `${geocode.street} ${geocode.housenumber}, ${geocode.city}`;
        }
    
        if (geocode.housenumber && geocode.city) {
            return `${geocode.housenumber} ${geocode.city}`;
        }
        if (geocode.street && geocode.city) {
            return `${geocode.street}, ${geocode.city}`;
        }
        if (geocode.district && geocode.city) {
            return `${geocode.district}, ${geocode.city}`;
        }

        console.log(JSON.stringify(geocode, null, '  '))
        return '-';
    
    }
    catch(error) {
        console.log(error.stack);
        return '-';
    }
}


async function testLocation(name, latitude, longitude) {

    let location = await getLocationName(latitude, longitude);
    console.log(`${name}: ${location}`);

    return location;

}


async function main() {

    await testLocation('Per', 59.30699422731109, 18.201528349536932);
    await testLocation('Nova Lund', 55.71405232841775, 13.159286249418354);
    await testLocation('Rondellen vid Nova Lund', 55.71257761225508, 13.156743515374469);
    await testLocation('Någonstans i skogen', 57.80899515129857, 15.754920122043465);
    await testLocation('Falafel by Youssif', 55.5570315242422, 13.035898618724664);
    await testLocation('Joakims innergård', 55.70962103331498, 13.368639026184326);
    await testLocation('Kuggeboda mitt på gräsmattan', 56.14330619348687, 15.377483238697867);
    await testLocation('Parkeringen på Willys Norra Fäladen', 55.72037011175005, 13.221359789671045);
    await testLocation('Mitt på Mårtenstorget', 55.70173514025194, 13.195914270142847);
    await testLocation('Någonstans i skåne', 55.68434262523176, 13.889041051776582);
    await testLocation('Uppfarten', 55.70404668562094, 13.21051271109514);
    await testLocation('Mitt i en åker nordöst om Lund', 55.741078824123534, 13.265618694925802);
    await testLocation('Lomma Beach vid vattnet', 55.677946848389624, 13.058541426217547);
    await testLocation('McDonalds, Norra Fäladen', 55.72085011230861, 13.200734848102911);

    
    
    
}

main();