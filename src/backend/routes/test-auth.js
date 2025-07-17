// テスト専用認可API - 権限制御テスト用エンドポイント
import express from 'express';
import { getUserPermissionLevel, canUserPerformAction, canUserAccess, getUserPermissions } from '../services/authorizationService.js';

const router = express.Router();

/**
 * テスト専用: 指定されたemailの権限レベルを取得
 * GET /test/auth/permission?email=test@example.com
 */
router.get('/permission', (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'email parameter is required' });
        }

        const permissionLevel = getUserPermissionLevel(email);
        const permissions = getUserPermissions(email);
        const canAccess = canUserAccess(email);

        res.json({
            email,
            permissionLevel,
            permissions,
            canAccess,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * テスト専用: 指定されたemailとactionの権限チェック
 * GET /test/auth/action?email=test@example.com&action=delete
 */
router.get('/action', (req, res) => {
    try {
        const { email, action } = req.query;
        if (!email || !action) {
            return res.status(400).json({ error: 'email and action parameters are required' });
        }

        const canPerform = canUserPerformAction(email, action);
        const permissionLevel = getUserPermissionLevel(email);

        res.json({
            email,
            action,
            canPerform,
            permissionLevel,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * テスト専用: 全認可設定の概要を取得
 * GET /test/auth/config
 */
router.get('/config', (req, res) => {
    try {
        // 認可設定の概要情報（実際のemailは隠す）
        const testEmails = [
            'admin@example.com',
            'testuser@example.com', 
            'readonly@example.com',
            'blocked@example.com',
            'unknown@example.com'
        ];

        const configSummary = testEmails.map(email => ({
            email,
            permissionLevel: getUserPermissionLevel(email),
            canAccess: canUserAccess(email),
            permissions: getUserPermissions(email)
        }));

        res.json({
            configSummary,
            timestamp: new Date().toISOString(),
            testNote: 'This is a test endpoint for authorization system verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// デバッグ用のHydra設定確認エンドポイント
router.get('/hydra-config', (req, res) => {
    try {
        const hydraConfig = {
            // FQDNごとの設定取得
            ...(() => {
              const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
              const { getAuthProviderConfig } = require('../authProviderConfig.js');
              const hydraConfig = getAuthProviderConfig(fqdn, 'hydra') || {};
              return {
                HYDRA_CLIENT_ID: hydraConfig.HYDRA_CLIENT_ID,
                HYDRA_CALLBACK_URL: hydraConfig.HYDRA_CALLBACK_URL,
                HYDRA_AUTH_URL: hydraConfig.HYDRA_AUTH_URL,
                HYDRA_TOKEN_URL_INTERNAL: hydraConfig.HYDRA_TOKEN_URL_INTERNAL,
                HYDRA_ADMIN_URL: hydraConfig.HYDRA_ADMIN_URL,
                HYDRA_ADMIN_URL_INTERNAL: hydraConfig.HYDRA_ADMIN_URL_INTERNAL,
                HYDRA_USERINFO_URL_INTERNAL: hydraConfig.HYDRA_USERINFO_URL_INTERNAL,
                HYDRA_SCOPE: hydraConfig.HYDRA_SCOPE
              };
            })()
        };
        
        res.json({
            hydraConfig,
            timestamp: new Date().toISOString(),
            debugNote: 'This is a debug endpoint for Hydra configuration verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
