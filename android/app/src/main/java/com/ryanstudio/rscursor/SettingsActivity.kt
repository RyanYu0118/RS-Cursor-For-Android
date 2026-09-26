package com.ryanstudio.rscursor

import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ryanstudio.rscursor.databinding.ActivitySettingsBinding

/** First-run / later edits of the Auto host URL. */
class SettingsActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.hostUrl.setText(HostPrefs.get(this).trimEnd('/'))
        binding.hostUrl.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                save()
                true
            } else {
                false
            }
        }
        binding.save.setOnClickListener { save() }
    }

    private fun save() {
        val raw = binding.hostUrl.text?.toString().orEmpty()
        val normalized = HostPrefs.normalize(raw)
        if (normalized.isEmpty()) {
            Toast.makeText(this, R.string.missing_host, Toast.LENGTH_SHORT).show()
            return
        }
        HostPrefs.set(this, normalized)
        setResult(RESULT_OK)
        finish()
    }
}
