#!/bin/bash
cd "$(dirname "$0")"
java --module-path /opt/homebrew/opt/openjfx/libexec/lib --add-modules javafx.controls,javafx.fxml,javafx.web,javafx.media,javafx.graphics -jar target/poker-game-1.0-SNAPSHOT-jar-with-dependencies.jar
