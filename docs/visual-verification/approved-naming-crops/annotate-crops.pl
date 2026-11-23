use strict;
use warnings;
use MIME::Base64 qw(encode_base64);
my $dir="docs/visual-verification/approved-naming-crops";
my @jobs=(
["landscape",1,267,605,[
["deck",1,1,264,602],["performance-view",3,3,260,598],
["performance-header",5,5,256,160],["performance-content",5,167,256,433],
["wave-and-cue",7,169,252,429],["waveform-overview",6,123,255,41],
["scrolling-waveform",6,168,255,186],["current-playback-time",6,356,150,14],
["cue-pads",6,374,255,188],["loop-controls",7,565,254,35]]],
["portrait",1,376,457,[
["deck",1,1,373,454],["performance-view",3,3,369,450],
["performance-header",5,5,365,155],["performance-content",5,162,365,290],
["wave-and-cue",7,164,361,286],["waveform-overview",5,123,365,36],
["scrolling-waveform",5,162,365,138],["current-playback-time",5,302,170,14],
["cue-pads",5,318,365,96],["loop-controls",6,418,364,33]]],
["landscape",2,268,605,[
["deck",1,1,265,602],["performance-view",3,3,261,598],
["performance-header",5,5,257,160],["performance-content",5,168,257,432],
["controls",7,170,253,428],["waveform-overview",6,123,256,41],
["filter-knob",10,191,55,55],["eq-knob",74,191,55,55],
["eq-knob",139,191,55,55],["eq-knob",204,191,55,55],
["effects-controls",6,271,256,104],["stem-faders",6,382,256,215]]],
["portrait",2,375,457,[
["deck",1,1,372,454],["performance-view",3,3,368,450],
["performance-header",5,5,364,155],["performance-content",5,162,364,289],
["controls",7,164,360,285],["waveform-overview",5,123,364,36],
["filter-knob",28,178,40,40],["eq-knob",121,178,40,40],
["eq-knob",213,178,40,40],["eq-knob",305,178,40,40],
["effects-controls",5,232,364,86],["stem-faders",5,324,364,125]]],
["landscape",3,267,605,[
["deck",1,1,264,602],["library-view",3,3,260,598],
["library-header",5,5,256,40],["library-content",5,48,256,551],
["section-selector",23,9,198,29],["back-to-performance-button",227,7,33,33],
["song-sort-selector",6,53,217,28],["search",6,86,254,28],
["search-results",6,150,254,390],["search-result",6,150,254,59],
["send-to-deck-one",6,565,60,34],["send-to-deck-two",69,565,61,34],
["send-to-deck-three",133,565,62,34],["send-to-deck-four",198,565,62,34]]],
["portrait",3,376,472,[
["deck",1,1,373,469],["library-view",3,3,369,465],
["library-header",5,5,365,40],["library-content",5,48,365,419],
["section-selector",24,9,306,29],["back-to-performance-button",336,7,33,33],
["song-sort-selector",8,53,323,27],["search",5,86,365,28],
["search-results",8,143,361,278],["search-result",8,143,361,49],
["send-to-deck-one",6,432,85,33],["send-to-deck-two",94,432,92,33],
["send-to-deck-three",189,432,92,33],["send-to-deck-four",284,432,85,33]]]
);
my @colors=("#f59e0b","#a78bfa","#22d3ee","#fb7185","#4ade80","#facc15","#60a5fa");
for my $job (@jobs) {
 my ($orientation,$deck,$w,$h,$regions)=@$job;
 open my $in,"<:raw","$dir/$orientation-deck-$deck.png" or die $!;
 local $/; my $b64=encode_base64(<$in>,""); close $in;
 my $cw=$w+530; my $ch=$h+130;
 my $svg=qq{<svg xmlns="http://www.w3.org/2000/svg" width="$cw" height="$ch" viewBox="0 0 $cw $ch"><rect width="100%" height="100%" fill="#f8fafc"/><g font-family="Arial, sans-serif"><text x="24" y="30" font-size="20" font-weight="bold">H5.3.1 · Deck $deck · $orientation</text><text x="24" y="51" font-size="12" fill="#475569">Approved crop at original pixel size · numbered section boundaries</text><image x="50" y="75" width="$w" height="$h" href="data:image/png;base64,$b64"/>};
 my $i=0;my $lx=50+$w+43;
 for my $r (@$regions) {
  my ($name,$x,$y,$rw,$rh)=@$r;my $c=$colors[$i%@colors];$i++;
  my $ax=$x+50;my $ay=$y+75;
  my $dash=($i==2||$i==5)?' stroke-dasharray="5 3"':'';
  $svg.=qq{<rect x="$ax" y="$ay" width="$rw" height="$rh" fill="none" stroke="$c" stroke-width="1.5"$dash/>};
  # Tiny numbered reference on the border; full names remain outside the interface.
  my $tx=$ax+$rw-7;my $ty=$ay+8;
  $ty=$ay+$rh-8 if $name eq 'search-results';
  if ($i<=4 || $name eq 'wave-and-cue' || $name eq 'controls') {
   $tx=($i%2)?12:31;
   $ty=($i<=3)?(78+$i*21):($ay+25+($i-4)*23);
   $svg.=qq{<path d="M }.($tx+7).qq{ $ty H $ax" fill="none" stroke="$c" stroke-width="1"/>};
  }
  $svg.=qq{<circle cx="$tx" cy="$ty" r="7" fill="#0f172a" stroke="$c"/><text x="$tx" y="}.($ty+3).qq{" text-anchor="middle" fill="white" font-size="9">$i</text>};
  my $ly=96+($i-1)*30;
  $svg.=qq{<circle cx="$lx" cy="}.($ly-4).qq{" r="10" fill="#0f172a" stroke="$c" stroke-width="2"/><text x="$lx" y="$ly" text-anchor="middle" fill="white" font-size="11">$i</text><text x="}.($lx+19).qq{" y="$ly" font-family="monospace" font-size="14" fill="#0f172a">$name</text>};
 }
 $svg.=qq{<text x="$lx" y="}.(115+$i*30).qq{" font-size="12" fill="#475569">Nested views share the same visible region.</text><text x="24" y="}.($ch-19).qq{" font-size="12" fill="#475569">Section annotation checkpoint · new approved names · no design changes</text></g></svg>};
 open my $out,">:raw","$dir/$orientation-deck-$deck-annotated.svg" or die $!;print $out $svg;close $out;
}

