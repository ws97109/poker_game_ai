package com.example;

import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.web.WebView;
import javafx.stage.Stage;
import javafx.scene.web.WebEngine;
import java.net.URL;
import java.nio.file.Path;
import java.nio.file.Paths;

public class PokerGameApp extends Application {
    @Override
    public void start(Stage primaryStage) {
        WebView webView = new WebView();
        WebEngine webEngine = webView.getEngine();
        
        // 開發模式：使用文件系統路徑
        Path devPath = Paths.get("src/main/resources/game_final.html");
        if (devPath.toFile().exists()) {
            System.out.println("在開發模式下運行，使用文件系統路徑");
            webEngine.load(devPath.toUri().toString());
        } else {
            // 生產模式：使用資源加載器
            URL resourceUrl = getClass().getResource("/game_final.html");
            if (resourceUrl != null) {
                System.out.println("在生產模式下運行，使用資源加載器");
                webEngine.load(resourceUrl.toExternalForm());
            } else {
                // 如果兩種方式都失敗，提供詳細的錯誤信息
                System.err.println("無法加載HTML文件");
                System.err.println("開發路徑：" + devPath.toAbsolutePath());
                System.err.println("當前工作目錄：" + System.getProperty("user.dir"));
                System.err.println("請確保文件位於正確的位置並具有正確的訪問權限");
                return;
            }
        }

        // 設置場景和視窗
        Scene scene = new Scene(webView, 1200, 800);
        primaryStage.setTitle("德州撲克遊戲");
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}