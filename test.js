let getCoordinatesFromText = (location) => {

	let regexp = /^.*\((.+),\s*(.+)\)$/
	let match = location.match(regexp);
    let coordinates = undefined;

    if (match && match.length == 3) {
        let latitude = parseFloat(match[1]);
        let longitude = parseFloat(match[2]);

        if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
            coordinates =  {
                latitude: latitude,
                longitude: longitude
            };
    
        }
    
    }
    console.log(coordinates);
    return coordinates;
}

getCoordinatesFromText('Noval Lund (55.71479215631524, 13.156477446180576)');
getCoordinatesFromText('(55.71479215631524, 13.156 477446180576)');
getCoordinatesFromText('(554.71479215631524, 13.156 477446180576)');
getCoordinatesFromText('(55,71479215631524, 13,477446180576)');
