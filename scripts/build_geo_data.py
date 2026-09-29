"""Genera lib/geoData.ts (regiones y ciudades principales con coordenadas).
Datos incluidos para que la cascada País -> Estado -> Ciudad funcione sin red."""
import json, os

RAW = {
"ES": """
Andalucía|Sevilla 37.3891 -5.9845;Málaga 36.7213 -4.4214;Granada 37.1773 -3.5986;Córdoba 37.8882 -4.7794;Almería 36.834 -2.4637;Cádiz 36.5271 -6.2886;Huelva 37.2614 -6.9447;Jaén 37.7796 -3.7849;Marbella 36.5101 -4.8825;Jerez de la Frontera 36.6850 -6.1261
Aragón|Zaragoza 41.6488 -0.8891;Huesca 42.1401 -0.4089;Teruel 40.3457 -1.1065
Asturias|Oviedo 43.3614 -5.8593;Gijón 43.5322 -5.6611;Avilés 43.5547 -5.9248
Illes Balears|Palma 39.5696 2.6502;Ibiza 38.9067 1.4206;Maó 39.8885 4.2658
Canarias|Las Palmas de Gran Canaria 28.1235 -15.4363;Santa Cruz de Tenerife 28.4636 -16.2518;San Cristóbal de La Laguna 28.4874 -16.3159;Arrecife 28.9630 -13.5477
Cantabria|Santander 43.4623 -3.8099;Torrelavega 43.3494 -4.0479
Castilla-La Mancha|Toledo 39.8628 -4.0273;Albacete 38.9943 -1.8585;Ciudad Real 38.9848 -3.9274;Guadalajara 40.6329 -3.1669;Cuenca 40.0704 -2.1374;Talavera de la Reina 39.9635 -4.8308
Castilla y León|Valladolid 41.6523 -4.7245;Burgos 42.3439 -3.6969;León 42.5987 -5.5671;Salamanca 40.9701 -5.6635;Segovia 40.9429 -4.1088;Ávila 40.6564 -4.6818;Palencia 42.0095 -4.5288;Soria 41.7666 -2.4790;Zamora 41.5034 -5.7468
Cataluña|Barcelona 41.3874 2.1686;L'Hospitalet de Llobregat 41.3596 2.0997;Badalona 41.4500 2.2474;Tarragona 41.1189 1.2445;Lleida 41.6176 0.6200;Girona 41.9794 2.8214;Sabadell 41.5463 2.1086;Terrassa 41.5610 2.0089
Comunitat Valenciana|Valencia 39.4699 -0.3763;Alicante 38.3452 -0.4810;Elche 38.2669 -0.6983;Castellón de la Plana 39.9864 -0.0513;Benidorm 38.5411 -0.1225;Torrevieja 37.9787 -0.6822
Extremadura|Mérida 38.9161 -6.3437;Badajoz 38.8794 -6.9707;Cáceres 39.4753 -6.3724
Galicia|Santiago de Compostela 42.8782 -8.5448;A Coruña 43.3623 -8.4115;Vigo 42.2406 -8.7207;Ourense 42.3358 -7.8639;Lugo 43.0097 -7.5568;Pontevedra 42.4310 -8.6444
Comunidad de Madrid|Madrid 40.4168 -3.7038;Alcalá de Henares 40.4818 -3.3643;Móstoles 40.3223 -3.8649;Getafe 40.3083 -3.7327;Leganés 40.3272 -3.7635;Alcobendas 40.5475 -3.6420;Fuenlabrada 40.2842 -3.7942;Pozuelo de Alarcón 40.4351 -3.8135;Las Rozas 40.4930 -3.8737
Región de Murcia|Murcia 37.9922 -1.1307;Cartagena 37.6257 -0.9966;Lorca 37.6771 -1.7003
Navarra|Pamplona 42.8125 -1.6458;Tudela 42.0617 -1.6045
País Vasco|Bilbao 43.2630 -2.9350;Vitoria-Gasteiz 42.8467 -2.6716;Donostia-San Sebastián 43.3183 -1.9812;Barakaldo 43.2976 -2.9892
La Rioja|Logroño 42.4627 -2.4450;Calahorra 42.3050 -1.9650
Ceuta|Ceuta 35.8894 -5.3213
Melilla|Melilla 35.2923 -2.9381
""",
"CO": """
Amazonas|Leticia -4.2153 -69.9406
Antioquia|Medellín 6.2442 -75.5812;Bello 6.3373 -75.5580;Envigado 6.1759 -75.5917;Itagüí 6.1846 -75.5991;Rionegro 6.1551 -75.3737
Arauca|Arauca 7.0903 -70.7617
Atlántico|Barranquilla 10.9685 -74.7813;Soledad 10.9184 -74.7646
Bogotá D.C.|Bogotá 4.7110 -74.0721
Bolívar|Cartagena 10.3910 -75.4794;Magangué 9.2415 -74.7540
Boyacá|Tunja 5.5353 -73.3678;Duitama 5.8269 -73.0203;Sogamoso 5.7145 -72.9339
Caldas|Manizales 5.0703 -75.5138
Caquetá|Florencia 1.6144 -75.6062
Casanare|Yopal 5.3378 -72.3959
Cauca|Popayán 2.4448 -76.6147
Cesar|Valledupar 10.4631 -73.2532
Chocó|Quibdó 5.6947 -76.6611
Córdoba|Montería 8.7479 -75.8814
Cundinamarca|Soacha 4.5794 -74.2168;Zipaquirá 5.0221 -74.0058;Fusagasugá 4.3365 -74.3638;Chía 4.8619 -74.0597;Facatativá 4.8137 -74.3545
Guainía|Inírida 3.8653 -67.9239
Guaviare|San José del Guaviare 2.5729 -72.6459
Huila|Neiva 2.9273 -75.2819
La Guajira|Riohacha 11.5444 -72.9072;Maicao 11.3777 -72.2390
Magdalena|Santa Marta 11.2408 -74.1990
Meta|Villavicencio 4.1420 -73.6266
Nariño|Pasto 1.2136 -77.2811;Ipiales 0.8303 -77.6445;Tumaco 1.7986 -78.8156
Norte de Santander|Cúcuta 7.8939 -72.5078
Putumayo|Mocoa 1.1522 -76.6526
Quindío|Armenia 4.5339 -75.6811
Risaralda|Pereira 4.8133 -75.6961;Dosquebradas 4.8392 -75.6673
San Andrés y Providencia|San Andrés 12.5847 -81.7006
Santander|Bucaramanga 7.1193 -73.1227;Floridablanca 7.0647 -73.0898;Barrancabermeja 7.0653 -73.8547
Sucre|Sincelejo 9.3047 -75.3978
Tolima|Ibagué 4.4389 -75.2322
Valle del Cauca|Cali 3.4516 -76.5320;Palmira 3.5394 -76.3036;Buenaventura 3.8801 -77.0312;Tuluá 4.0847 -76.1954
Vaupés|Mitú 1.2536 -70.2346
Vichada|Puerto Carreño 6.1890 -67.4859
""",
"MX": """
Aguascalientes|Aguascalientes 21.8853 -102.2916
Baja California|Tijuana 32.5149 -117.0382;Mexicali 32.6245 -115.4523;Ensenada 31.8667 -116.5964
Baja California Sur|La Paz 24.1426 -110.3128;San José del Cabo 23.0636 -109.7024
Campeche|Campeche 19.8301 -90.5349
Chiapas|Tuxtla Gutiérrez 16.7516 -93.1029;San Cristóbal de las Casas 16.7370 -92.6376
Chihuahua|Chihuahua 28.6320 -106.0691;Ciudad Juárez 31.6904 -106.4245
Ciudad de México|Ciudad de México 19.4326 -99.1332
Coahuila|Saltillo 25.4232 -101.0053;Torreón 25.5428 -103.4068
Colima|Colima 19.2452 -103.7241;Manzanillo 19.1138 -104.3385
Durango|Durango 24.0277 -104.6532
Estado de México|Toluca 19.2826 -99.6557;Ecatepec 19.6018 -99.0507;Naucalpan 19.4785 -99.2396
Guanajuato|León 21.1250 -101.6860;Guanajuato 21.0190 -101.2574;Irapuato 20.6767 -101.3563
Guerrero|Chilpancingo 17.5515 -99.5006;Acapulco 16.8531 -99.8237
Hidalgo|Pachuca 20.1011 -98.7591
Jalisco|Guadalajara 20.6597 -103.3496;Zapopan 20.7236 -103.3848;Puerto Vallarta 20.6534 -105.2253
Michoacán|Morelia 19.7060 -101.1950
Morelos|Cuernavaca 18.9242 -99.2216
Nayarit|Tepic 21.5042 -104.8946
Nuevo León|Monterrey 25.6866 -100.3161;San Pedro Garza García 25.6573 -100.4022
Oaxaca|Oaxaca de Juárez 17.0732 -96.7266
Puebla|Puebla 19.0414 -98.2063
Querétaro|Querétaro 20.5888 -100.3899
Quintana Roo|Cancún 21.1619 -86.8515;Chetumal 18.5001 -88.2961;Playa del Carmen 20.6296 -87.0739
San Luis Potosí|San Luis Potosí 22.1565 -100.9855
Sinaloa|Culiacán 24.8091 -107.3940;Mazatlán 23.2494 -106.4111
Sonora|Hermosillo 29.0729 -110.9559
Tabasco|Villahermosa 17.9892 -92.9475
Tamaulipas|Ciudad Victoria 23.7369 -99.1411;Reynosa 26.0508 -98.2979;Tampico 22.2331 -97.8611
Tlaxcala|Tlaxcala 19.3139 -98.2404
Veracruz|Xalapa 19.5438 -96.9102;Veracruz 19.1738 -96.1342
Yucatán|Mérida 20.9674 -89.5926
Zacatecas|Zacatecas 22.7709 -102.5832
""",
"AR": """
Ciudad Autónoma de Buenos Aires|Buenos Aires -34.6037 -58.3816
Buenos Aires|La Plata -34.9205 -57.9536;Mar del Plata -38.0055 -57.5426;Bahía Blanca -38.7183 -62.2663
Catamarca|San Fernando del Valle de Catamarca -28.4696 -65.7852
Chaco|Resistencia -27.4606 -58.9839
Chubut|Rawson -43.3002 -65.1023;Comodoro Rivadavia -45.8641 -67.4966
Córdoba|Córdoba -31.4201 -64.1888
Corrientes|Corrientes -27.4692 -58.8306
Entre Ríos|Paraná -31.7333 -60.5297
Formosa|Formosa -26.1775 -58.1781
Jujuy|San Salvador de Jujuy -24.1858 -65.2995
La Pampa|Santa Rosa -36.6167 -64.2833
La Rioja|La Rioja -29.4131 -66.8558
Mendoza|Mendoza -32.8895 -68.8458
Misiones|Posadas -27.3671 -55.8961
Neuquén|Neuquén -38.9516 -68.0591
Río Negro|Viedma -40.8135 -62.9967;San Carlos de Bariloche -41.1335 -71.3103
Salta|Salta -24.7821 -65.4232
San Juan|San Juan -31.5375 -68.5364
San Luis|San Luis -33.2950 -66.3356
Santa Cruz|Río Gallegos -51.6230 -69.2168
Santa Fe|Santa Fe -31.6333 -60.7000;Rosario -32.9442 -60.6505
Santiago del Estero|Santiago del Estero -27.7951 -64.2615
Tierra del Fuego|Ushuaia -54.8019 -68.3030
Tucumán|San Miguel de Tucumán -26.8083 -65.2176
""",
"CL": """
Arica y Parinacota|Arica -18.4783 -70.3126
Tarapacá|Iquique -20.2307 -70.1357
Antofagasta|Antofagasta -23.6509 -70.3975;Calama -22.4544 -68.9294
Atacama|Copiapó -27.3668 -70.3314
Coquimbo|La Serena -29.9027 -71.2519;Coquimbo -29.9533 -71.3436
Valparaíso|Valparaíso -33.0472 -71.6127;Viña del Mar -33.0245 -71.5518
Región Metropolitana|Santiago -33.4489 -70.6693;Puente Alto -33.6117 -70.5758;Maipú -33.5167 -70.7667
O'Higgins|Rancagua -34.1708 -70.7444
Maule|Talca -35.4264 -71.6554
Ñuble|Chillán -36.6066 -72.1034
Biobío|Concepción -36.8201 -73.0444
La Araucanía|Temuco -38.7359 -72.5904
Los Ríos|Valdivia -39.8196 -73.2452
Los Lagos|Puerto Montt -41.4693 -72.9424
Aysén|Coyhaique -45.5712 -72.0685
Magallanes|Punta Arenas -53.1638 -70.9171
""",
"PE": """
Amazonas|Chachapoyas -6.2317 -77.8690
Áncash|Huaraz -9.5278 -77.5278;Chimbote -9.0853 -78.5783
Apurímac|Abancay -13.6339 -72.8814
Arequipa|Arequipa -16.4090 -71.5375
Ayacucho|Ayacucho -13.1588 -74.2239
Cajamarca|Cajamarca -7.1638 -78.5003
Callao|Callao -12.0566 -77.1181
Cusco|Cusco -13.5320 -71.9675
Huancavelica|Huancavelica -12.7864 -74.9764
Huánuco|Huánuco -9.9306 -76.2422
Ica|Ica -14.0678 -75.7286
Junín|Huancayo -12.0651 -75.2049
La Libertad|Trujillo -8.1116 -79.0288
Lambayeque|Chiclayo -6.7714 -79.8409
Lima|Lima -12.0464 -77.0428
Loreto|Iquitos -3.7437 -73.2516
Madre de Dios|Puerto Maldonado -12.5933 -69.1891
Moquegua|Moquegua -17.1983 -70.9357
Pasco|Cerro de Pasco -10.6864 -76.2625
Piura|Piura -5.1945 -80.6328
Puno|Puno -15.8402 -70.0219;Juliaca -15.5000 -70.1333
San Martín|Moyobamba -6.0342 -76.9717;Tarapoto -6.4825 -76.3656
Tacna|Tacna -18.0146 -70.2536
Tumbes|Tumbes -3.5669 -80.4515
Ucayali|Pucallpa -8.3791 -74.5539
""",
"VE": """
Amazonas|Puerto Ayacucho 5.6639 -67.6236
Anzoátegui|Barcelona 10.1333 -64.6833;Puerto La Cruz 10.2167 -64.6333
Apure|San Fernando de Apure 7.8878 -67.4724
Aragua|Maracay 10.2469 -67.5958
Barinas|Barinas 8.6226 -70.2075
Bolívar|Ciudad Bolívar 8.1292 -63.5409;Ciudad Guayana 8.3533 -62.6528
Carabobo|Valencia 10.1620 -68.0077
Cojedes|San Carlos 9.6612 -68.5827
Delta Amacuro|Tucupita 9.0622 -62.0510
Distrito Capital|Caracas 10.4806 -66.9036
Falcón|Coro 11.4045 -69.6734;Punto Fijo 11.6956 -70.1997
Guárico|San Juan de los Morros 9.9117 -67.3538
La Guaira|La Guaira 10.6012 -66.9330
Lara|Barquisimeto 10.0678 -69.3474
Mérida|Mérida 8.5897 -71.1561
Miranda|Los Teques 10.3447 -67.0433;Petare 10.4833 -66.8167
Monagas|Maturín 9.7457 -63.1832
Nueva Esparta|La Asunción 11.0333 -63.8628;Porlamar 10.9577 -63.8497
Portuguesa|Guanare 9.0418 -69.7421;Acarigua 9.5597 -69.2019
Sucre|Cumaná 10.4530 -64.1826
Táchira|San Cristóbal 7.7669 -72.2250
Trujillo|Trujillo 9.3667 -70.4333;Valera 9.3178 -70.6036
Yaracuy|San Felipe 10.3399 -68.7425
Zulia|Maracaibo 10.6427 -71.6125
""",
"EC": """
Azuay|Cuenca -2.9001 -79.0059
Bolívar|Guaranda -1.5926 -79.0010
Cañar|Azogues -2.7397 -78.8486
Carchi|Tulcán 0.8117 -77.7173
Chimborazo|Riobamba -1.6636 -78.6546
Cotopaxi|Latacunga -0.9352 -78.6155
El Oro|Machala -3.2581 -79.9554
Esmeraldas|Esmeraldas 0.9682 -79.6517
Galápagos|Puerto Baquerizo Moreno -0.9017 -89.6103
Guayas|Guayaquil -2.1710 -79.9224
Imbabura|Ibarra 0.3517 -78.1223
Loja|Loja -3.9931 -79.2042
Los Ríos|Babahoyo -1.8022 -79.5344
Manabí|Portoviejo -1.0546 -80.4545;Manta -0.9677 -80.7089
Morona Santiago|Macas -2.3087 -78.1114
Napo|Tena -0.9938 -77.8129
Orellana|Puerto Francisco de Orellana -0.4629 -76.9872
Pastaza|Puyo -1.4924 -78.0024
Pichincha|Quito -0.1807 -78.4678
Santa Elena|Santa Elena -2.2262 -80.8587
Santo Domingo de los Tsáchilas|Santo Domingo -0.2530 -79.1754
Sucumbíos|Nueva Loja 0.0847 -76.8828
Tungurahua|Ambato -1.2491 -78.6168
Zamora Chinchipe|Zamora -4.0692 -78.9567
""",
"US": """
Alabama|Montgomery 32.3792 -86.3077;Birmingham 33.5186 -86.8104
Alaska|Juneau 58.3019 -134.4197;Anchorage 61.2181 -149.9003
Arizona|Phoenix 33.4484 -112.0740;Tucson 32.2226 -110.9747
Arkansas|Little Rock 34.7465 -92.2896
California|Sacramento 38.5816 -121.4944;Los Angeles 34.0522 -118.2437;San Francisco 37.7749 -122.4194;San Diego 32.7157 -117.1611
Colorado|Denver 39.7392 -104.9903
Connecticut|Hartford 41.7658 -72.6734;Bridgeport 41.1865 -73.1952
Delaware|Dover 39.1582 -75.5244;Wilmington 39.7391 -75.5398
District of Columbia|Washington 38.9072 -77.0369
Florida|Tallahassee 30.4383 -84.2807;Miami 25.7617 -80.1918;Orlando 28.5383 -81.3792;Tampa 27.9506 -82.4572
Georgia|Atlanta 33.7490 -84.3880
Hawaii|Honolulu 21.3069 -157.8583
Idaho|Boise 43.6150 -116.2023
Illinois|Springfield 39.7817 -89.6501;Chicago 41.8781 -87.6298
Indiana|Indianapolis 39.7684 -86.1581
Iowa|Des Moines 41.5868 -93.6250
Kansas|Topeka 39.0473 -95.6752;Wichita 37.6872 -97.3301
Kentucky|Frankfort 38.2009 -84.8733;Louisville 38.2527 -85.7585
Louisiana|Baton Rouge 30.4515 -91.1871;New Orleans 29.9511 -90.0715
Maine|Augusta 44.3106 -69.7795;Portland 43.6591 -70.2568
Maryland|Annapolis 38.9784 -76.4922;Baltimore 39.2904 -76.6122
Massachusetts|Boston 42.3601 -71.0589
Michigan|Lansing 42.7325 -84.5555;Detroit 42.3314 -83.0458
Minnesota|Saint Paul 44.9537 -93.0900;Minneapolis 44.9778 -93.2650
Mississippi|Jackson 32.2988 -90.1848
Missouri|Jefferson City 38.5767 -92.1735;Kansas City 39.0997 -94.5786;St. Louis 38.6270 -90.1994
Montana|Helena 46.5891 -112.0391;Billings 45.7833 -108.5007
Nebraska|Lincoln 40.8136 -96.7026;Omaha 41.2565 -95.9345
Nevada|Carson City 39.1638 -119.7674;Las Vegas 36.1699 -115.1398
New Hampshire|Concord 43.2081 -71.5376;Manchester 42.9956 -71.4548
New Jersey|Trenton 40.2206 -74.7597;Newark 40.7357 -74.1724
New Mexico|Santa Fe 35.6870 -105.9378;Albuquerque 35.0844 -106.6504
New York|Albany 42.6526 -73.7562;New York City 40.7128 -74.0060
North Carolina|Raleigh 35.7796 -78.6382;Charlotte 35.2271 -80.8431
North Dakota|Bismarck 46.8083 -100.7837;Fargo 46.8772 -96.7898
Ohio|Columbus 39.9612 -82.9988;Cleveland 41.4993 -81.6944
Oklahoma|Oklahoma City 35.4676 -97.5164
Oregon|Salem 44.9429 -123.0351;Portland 45.5152 -122.6784
Pennsylvania|Harrisburg 40.2732 -76.8867;Philadelphia 39.9526 -75.1652;Pittsburgh 40.4406 -79.9959
Rhode Island|Providence 41.8240 -71.4128
South Carolina|Columbia 34.0007 -81.0348;Charleston 32.7765 -79.9311
South Dakota|Pierre 44.3683 -100.3510;Sioux Falls 43.5446 -96.7311
Tennessee|Nashville 36.1627 -86.7816;Memphis 35.1495 -90.0490
Texas|Austin 30.2672 -97.7431;Houston 29.7604 -95.3698;Dallas 32.7767 -96.7970;San Antonio 29.4241 -98.4936
Utah|Salt Lake City 40.7608 -111.8910
Vermont|Montpelier 44.2601 -72.5754;Burlington 44.4759 -73.2121
Virginia|Richmond 37.5407 -77.4360;Virginia Beach 36.8529 -75.9780
Washington|Olympia 47.0379 -122.9007;Seattle 47.6062 -122.3321
West Virginia|Charleston 38.3498 -81.6326
Wisconsin|Madison 43.0731 -89.4012;Milwaukee 43.0389 -87.9065
Wyoming|Cheyenne 41.1400 -104.8202
""",
}

out = {}
for cc, block in RAW.items():
    regions = []
    for line in block.strip().splitlines():
        name, cities = line.split("|")
        cl = []
        for c in cities.split(";"):
            parts = c.strip().rsplit(" ", 2)
            cl.append([parts[0], float(parts[1]), float(parts[2])])
        regions.append([name, cl])
    out[cc] = regions

path = os.path.join(os.path.dirname(__file__), "..", "lib", "geoData.ts")
with open(path, "w") as f:
    f.write("// GENERADO por scripts/build_geo_data.py — no editar a mano.\n")
    f.write("// [región, [[ciudad, lat, lng], ...]] por país (ISO 3166-1 alfa-2).\n")
    f.write("export type CityTuple = [name: string, lat: number, lng: number];\n")
    f.write("export type RegionTuple = [name: string, cities: CityTuple[]];\n")
    f.write("export const GEO_DATA: Record<string, RegionTuple[]> = ")
    f.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    f.write(";\n")
print({k: len(v) for k, v in out.items()})
