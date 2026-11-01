#!/bin/bash
# Setzt den Store-Trailer aus tools/trailer/<szene>/ zusammen: bash tools/trailer.sh → store/rift-armada-trailer.mp4
set -e
cd "$(dirname "$0")/trailer"
ENC="-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -r 30"
mkdir -p parts; rm -f parts/*.mp4 list.txt
still() { # bild sekunden name
  ffmpeg -loglevel error -y -framerate 30 -i "$1" -vf "scale=1920:1080:flags=lanczos,format=yuv420p,loop=-1:1,trim=duration=$2,fade=t=in:st=0:d=0.5,fade=t=out:st=$(echo "$2-0.5" | bc):d=0.5" $ENC parts/tmp.mp4 && mv parts/tmp.mp4 "parts/$3.mp4"; echo "file 'parts/$3.mp4'" >> list.txt; }
clip() { # ordner name
  n=$(ls "$1" | wc -l); d=$(echo "scale=3; $n/15" | bc)
  ffmpeg -loglevel error -y -framerate 15 -i "$1/%04d.jpg" -vf "scale=1920:1080:flags=lanczos,fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$d-0.4" | bc):d=0.4" $ENC parts/tmp.mp4 && mv parts/tmp.mp4 "parts/$2.mp4"; echo "file 'parts/$2.mp4'" >> list.txt; }
still cards/title.jpg 3 a-title
for s in battle factions board base; do [ -d $s ] && clip $s b-$s; done
still cards/menu.jpg 3 c-menu
still cards/end.jpg 4 d-end
ffmpeg -loglevel error -y -f concat -safe 0 -i list.txt -c copy video.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4)
# Klangteppich: tiefe Quinte mit langsamem Schweben, Ein- und Ausblenden
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.16*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.11*t))+0.10*sin(2*PI*82.5*t)*(0.6+0.4*sin(2*PI*0.07*t+1))+0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.23*t))|0.16*sin(2*PI*55.4*t)*(0.6+0.4*sin(2*PI*0.13*t))+0.10*sin(2*PI*82.9*t)*(0.6+0.4*sin(2*PI*0.09*t+2))+0.05*sin(2*PI*221*t)*(0.5+0.5*sin(2*PI*0.19*t)):s=48000:d=$D'" -af "afade=t=in:d=1.5,afade=t=out:st=$(echo "$D-2" | bc):d=2,aecho=0.8:0.6:400|700:0.3|0.2" -c:a aac -b:a 160k audio.m4a
ffmpeg -loglevel error -y -i video.mp4 -i audio.m4a -map 0:v -map 1:a -c:v copy -shortest ../../store/rift-armada-trailer.mp4
echo "store/rift-armada-trailer.mp4 $D s"
