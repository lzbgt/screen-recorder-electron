// For keeping track of movement
var divider2storage = $("#editor-1").width();

$(".divider").draggable({
  // restrict the movement to only horizontal
  axis: "x",
  cursor:"crosshair",
  cursorAt:{left:10},
  // restrict the movement to the row
  containment: $("#recordview"),
  drag: function(e, ui) {
    // divider-1
    if (ui.helper[0].id === "divider-1") {
      // let 2 flow
      $("#editor-2").css("flex", "1");
      // let 1 move
      $("#editor-1").css("flex", "0 1 " + (ui.offset.left - 20) + "px");
    }
  },
  stop: function(e, ui) {
    // // jQuery UI starts over at 0 when you move again
    // // (WHYYY, doesn't seem to in demos)
    // // So, storing it ourselves to use
    //
    // // If divider-2 moves, keep track of where it moved
    // if (ui.helper[0].id === "divider-2") {
    //   divider2storage = divider2storage + ui.position.left;
    //
    // // If divider-1 moves, use this value so any further movement of divider-2 starts where it should
    // } else {
      divider2storage = $("#editor-2").width();
    // }
  }
});
