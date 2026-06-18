<?php

namespace Drupal\canvas_ai\Controller;

use Drupal\Core\Controller\ControllerBase;

/**
 * Renders the Canvas AI chat admin page.
 */
class CanvasAiController extends ControllerBase {

  /**
   * Admin page callback for /admin/canvas-ai.
   */
  public function adminPage(): array {
    // Build the public URL that the *browser* uses to reach the Node.js bridge.
    // Priority: Codespaces auto-detected URL → CANVAS_BRIDGE_URL env var → localhost.
    $codespace = getenv('CODESPACE_NAME');
    $bridge_url = $codespace
      ? "https://{$codespace}-3000.app.github.dev"
      : (getenv('CANVAS_BRIDGE_URL') ?: 'http://localhost:3000');

    return [
      '#theme'  => 'canvas_ai_admin',
      '#cache'  => ['max-age' => 0],
      '#attached' => [
        'library'        => ['canvas_ai/admin_chat'],
        'drupalSettings' => [
          'canvasAi' => ['bridgeUrl' => $bridge_url],
        ],
      ],
    ];
  }

}
