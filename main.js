d3.select(window).on('load', main);


/* Here, we use d3.queue becasue we want to load the data concurrently. However,
   we need to be sure that both data files are done loading before calling
   the visualization function since d3.json is a async call.
   See https://github.com/d3/d3-queue for more details. */
function main(handsJSON) {
  d3.queue()
    .defer(d3.json, "sfpd_districts.geojson")  // police districts
    .defer(d3.json, "sf_crime.geojson")  // criminal occurrences
    .await(function(errMsg, data1, data2) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        visualize(data1, data2)
      }
    })
}


/* This object will hold all the magic numbers and elements that need to be
   accessed globally for the entire visualization. */
var vis = {}
vis.width = 1200
vis.height = 720
vis.crime = {}
vis.crime.r = 1.5
var active = d3.select(null)

/* This function organizes the entire visualization. It is called after the
   data files are loaded. */
function visualize(districts, crimes) {
  /* Just a sanity check */
  console.log("Districts", districts)
  console.log("Crime", crimes)

  /* Build up the initial state of the map visualization. */
  initMap()
  initDistricts(districts)
  initCriminalOccurences(crimes)

  /* TODO: do something interactive and data mining-ish here */
}


/* This function sets up the main svg element for the map visualization */
function initMap() {

  vis.svg = d3.select("#map-main")
    .attr("width", vis.width)
    .attr("height", vis.height)

  vis.svg.append("rect")
    .attr("id", "map-background")
    .attr("class", "background")
    .attr("width", vis.width)
    .attr("height", vis.height)
    .on("click", handle_map_unselect_district)

  vis.map = vis.svg.append("g")
    .attr("id", "map-elements")

}


/* This function draws all the districts on the map. */
function initDistricts(data) {

  /* Here, we set the type of map projection we will use. Mercator is just
     one of many options available, but in this context it seems to be the most
     appropriate since we are zoomed into a city scale, where the curvature of
     the Earth is faily negligible. See https://github.com/d3/d3-geo. */
  vis.projection = d3.geoMercator()
      .fitSize([vis.width, vis.height], data)

  /* Here we create a generator for the district outlines. */
  vis.outlines = d3.geoPath().projection(vis.projection)

  /* Container for all the districts. */
  let districts = vis.map.append("g")
    .attr("id", "districts")

  /* Create placeholders for each district */
  districts.selectAll("path")
    .data(data.features)

  /* Define all the districts to be added to the map. */
    .enter()
    .append("path")
    .attr("id", function(d) { return d.properties.district.toLowerCase() })
    .classed("district", true)
    .attr("d", vis.outlines)

  /* Allow users to zoom for better exploration of the map */
  /* This interaction was adapted from https://bl.ocks.org/mbostock/4699541 */
    .on("click", handle_map_select_district)
}


function handle_map_select_district(d) {
  if (active.node() === this) return handle_map_unselect_district();
  active.classed("active", false);
  active = d3.select(this).classed("active", true);

  var bounds = vis.outlines.bounds(d),
    dx = bounds[1][0] - bounds[0][0],
    dy = bounds[1][1] - bounds[0][1],
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    scale = .9 / Math.max(dx / vis.width, dy / vis.height),
    translate = [vis.width / 2 - scale * x, vis.height / 2 - scale * y];

  /* We added this block to scale the visual weight of the data points */
  console.log(scale)
  vis.crime.r = 2.5 * (1.0 / scale)
  vis.map.selectAll(".crime")
    .attr("r", vis.crime.r)

  vis.map.transition()
    .duration(850)
    .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
}

function handle_map_unselect_district() {
  active.classed("active", false);
  active = d3.select(null);

  /* We added this block to scale the visual weight of the data points */
  vis.crime.r = 1.5
  vis.map.selectAll(".crime")
    .attr("r", vis.crime.r)

  vis.map.transition()
    .duration(850)
    .attr("transform", "");
}


/* This function draws all the criminal occurences as points of the map. */
function initCriminalOccurences(data) {

  /* Container for all criminal occurences. */
  let crimes = vis.map.append("g")
    .attr("id", "crime-occurences")

  /* Create placeholders for each occurence. */
  crimes.selectAll("circle")
    .data(data.features)

    /* Define the data points to be added to the map */
    .enter()
    .append("circle")
    .attr("id", function(d, i) { return set_crime_id(i) })
    .attr("class", function(d) { return d.properties.PdDistrict.toLowerCase() })
    .classed("crime", true)
    .attr("cx", function(d) { return vis.projection([d.properties.X, d.properties.Y])[0] })
    .attr("cy", function(d) { return vis.projection([d.properties.X, d.properties.Y])[1] })
    .attr("r", vis.crime.r)

    /* Hovering will temporarily enlarge a given data point. */
    .on("mouseover", function(d, i) {
      d3.select(get_crime_id(i))
        .attr("r", 3 * vis.crime.r)
      })
    .on("mouseout", function(d, i) {
      d3.select(get_crime_id(i))
        .attr("r", vis.crime.r)
      })

    /* Use d3's svg tooltip to display info about each crime on-the-fly. */
    /* ATTN: This probably won't work as expected in the IE browser! */
    .append("title")
    .text(function(d,i) { return get_crime_info(d, i) })
}

/* Some useful helper functions */
function get_crime_id(i) { return "#c" + i }
function set_crime_id(i) { return "c" + i }

function get_crime_info(d, i) {
  return "Crime No. " + i + "\n" +
  "Category: " + d.properties.Category.toLowerCase() + "\n" +
  "District: " + d.properties.PdDistrict.toLowerCase() + "\n" +
  "Address: " + d.properties.Address.toLowerCase() + "\n" +
  "Date: " + d.properties.Dates + "\n" +
  "Day: " + d.properties.DayOfWeek.toLowerCase() + "\n" +
  "Description: " + d.properties.Descript.toLowerCase() + "\n" +
  "Resolution: " + d.properties.Resolution.toLowerCase()
}